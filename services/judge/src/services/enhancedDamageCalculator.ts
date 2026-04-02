import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';

export interface ExecutionResult {
  passed: number;
  total: number;
  runtime_ms: number;
  memory_kb: number;
  statusCode: number;
  statusDescription: string;
  testCaseResults: any[];
  correctnessRatio: number;
}

export interface BattleDamageResult {
  damage: number;
  opponentHp: number;
  isBattleOver: boolean;
  winner?: string;
  damageBreakdown: {
    baseDamage: number;
    speedBonus: number;
    firstSolveBonus: number;
    partialCredit: number;
    total: number;
  };
  executionResult: ExecutionResult;
  isFirstSolve: boolean;
}

export interface PuzzleBenchmark {
  puzzleId: string;
  language: string;
  p50RuntimeMs: number;
  p95RuntimeMs: number;
  avgMemoryKb: number;
  sampleSize: number;
  lastUpdated: Date;
}

export class EnhancedDamageCalculator {
  private redis: RedisClientType;
  private prisma: PrismaClient;
  
  // Damage calculation constants
  private readonly MAX_DAMAGE = 70;
  private readonly BASE_DAMAGE = 20;
  private readonly SPEED_BONUS_MAX = 15;
  private readonly FIRST_SOLVE_BONUS = 25;
  private readonly PERFECT_BONUS = 10;
  private readonly K_FACTOR = 32; // Variable K-factor based on games played

  constructor(redis: RedisClientType, prisma: PrismaClient) {
    this.redis = redis;
    this.prisma = prisma;
  }

  // Enhanced damage calculation with atomic first-solve checking
  async calculateBattleDamage(
    userId: string,
    roomId: string,
    executionResult: ExecutionResult,
    elapsedSeconds: number,
    timeLimitSeconds: number,
    opponentHp: number,
    puzzleBenchmark: PuzzleBenchmark | null,
    isFirstSolve: boolean
  ): Promise<BattleDamageResult> {
    try {
      // Atomic first-solve check using Redis
      const actualFirstSolve = await this.checkAndSetFirstSolve(roomId, userId);
      
      const damageBreakdown = this.calculateDamageComponents(
        executionResult,
        elapsedSeconds,
        timeLimitSeconds,
        puzzleBenchmark,
        actualFirstSolve
      );

      const totalDamage = Math.min(damageBreakdown.total, this.MAX_DAMAGE);
      const newOpponentHp = Math.max(0, opponentHp - totalDamage);
      const isBattleOver = newOpponentHp === 0;

      return {
        damage: totalDamage,
        opponentHp: newOpponentHp,
        isBattleOver,
        winner: isBattleOver ? userId : undefined,
        damageBreakdown: {
          ...damageBreakdown,
          total: totalDamage,
        },
        executionResult,
        isFirstSolve: actualFirstSolve,
      };
    } catch (error) {
      console.error('Error calculating battle damage:', error);
      throw new Error('Damage calculation failed');
    }
  }

  // Atomic first-solve check using Redis SETNX
  private async checkAndSetFirstSolve(roomId: string, userId: string): Promise<boolean> {
    const firstSolveKey = `battle:first_solve:${roomId}`;
    const result = await this.redis.set(firstSolveKey, userId, { NX: true, EX: 3600 }); // 1 hour TTL
    return result === 'OK';
  }

  // Calculate damage components with corrected formula
  private calculateDamageComponents(
    executionResult: ExecutionResult,
    elapsedSeconds: number,
    timeLimitSeconds: number,
    puzzleBenchmark: PuzzleBenchmark | null,
    isFirstSolve: boolean
  ) {
    const { passed, total, runtime_ms, correctnessRatio } = executionResult;

    // Base damage: 20 × correctnessRatio (no double counting)
    const baseDamage = this.BASE_DAMAGE * correctnessRatio;

    // Speed bonus based on remaining time
    const timeRemainingRatio = Math.max(0, (timeLimitSeconds - elapsedSeconds) / timeLimitSeconds);
    const speedBonus = Math.round(this.SPEED_BONUS_MAX * timeRemainingRatio);

    // First solve bonus
    const firstSolveBonus = isFirstSolve ? this.FIRST_SOLVE_BONUS : 0;

    // Perfect solution bonus
    const perfectBonus = correctnessRatio === 1.0 ? this.PERFECT_BONUS : 0;

    // Total damage (no separate partial credit - it's already in baseDamage)
    const total = baseDamage + speedBonus + firstSolveBonus + perfectBonus;

    return {
      baseDamage: Math.round(baseDamage),
      speedBonus,
      firstSolveBonus,
      partialCredit: 0, // No separate partial credit
      total: Math.round(total),
    };
  }

  // Enhanced ELO calculation with variable K-factor
  async calculateEloChange(
    winnerId: string,
    loserId: string,
    winnerElo: number,
    loserElo: number,
    isRanked: boolean = true
  ): Promise<{ winnerNewElo: number; loserNewElo: number; eloChange: number }> {
    if (!isRanked) {
      return { winnerNewElo: winnerElo, loserNewElo: loserElo, eloChange: 0 };
    }

    // Get games played for each player to determine K-factor
    const [winnerGames, loserGames] = await Promise.all([
      this.getGamesPlayed(winnerId),
      this.getGamesPlayed(loserId),
    ]);

    const winnerK = this.calculateKFactor(winnerGames, winnerElo);
    const loserK = this.calculateKFactor(loserGames, loserElo);

    // Expected scores
    const expectedWinner = this.calculateExpectedScore(winnerElo, loserElo);
    const expectedLoser = 1 - expectedWinner;

    // Actual scores (1 for winner, 0 for loser)
    const actualWinner = 1;
    const actualLoser = 0;

    // ELO changes
    const winnerEloChange = Math.round(winnerK * (actualWinner - expectedWinner));
    const loserEloChange = Math.round(loserK * (actualLoser - expectedLoser));

    return {
      winnerNewElo: Math.max(0, winnerElo + winnerEloChange),
      loserNewElo: Math.max(0, loserElo + loserEloChange),
      eloChange: Math.abs(winnerEloChange),
    };
  }

  // Variable K-factor based on games played and current ELO
  private calculateKFactor(gamesPlayed: number, currentElo: number): number {
    // New players get higher K-factor
    if (gamesPlayed < 30) {
      return 40;
    }
    
    // Established players get standard K-factor
    if (gamesPlayed < 100) {
      return this.K_FACTOR;
    }
    
    // Veterans get lower K-factor
    return 20;
  }

  private calculateExpectedScore(playerElo: number, opponentElo: number): number {
    const difference = opponentElo - playerElo;
    return 1 / (1 + Math.pow(10, difference / 400));
  }

  private async getGamesPlayed(userId: string): Promise<number> {
    const result = await this.prisma.battle.count({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
        status: 'COMPLETED',
      },
    });
    return result;
  }

  // Enhanced puzzle benchmark update with proper sampling
  async updatePuzzleBenchmark(
    puzzleId: string,
    language: string,
    runtimeMs: number,
    memoryKb: number
  ): Promise<void> {
    const benchmarkKey = `puzzle:benchmark:${puzzleId}:${language}`;
    
    try {
      // Get current benchmark data
      const current = await this.redis.hGetAll(benchmarkKey);
      
      let sampleSize = parseInt(current.sampleSize || '0');
      let currentP50 = parseFloat(current.p50RuntimeMs || '0');
      let currentP95 = parseFloat(current.p95RuntimeMs || '0');
      let currentAvgMemory = parseFloat(current.avgMemoryKb || '0');

      // Update running statistics
      sampleSize++;
      
      // For simplicity, using running average (in production, use proper percentile calculation)
      currentP50 = (currentP50 * (sampleSize - 1) + runtimeMs) / sampleSize;
      currentP95 = Math.max(currentP95, runtimeMs); // Simplified p95
      currentAvgMemory = (currentAvgMemory * (sampleSize - 1) + memoryKb) / sampleSize;

      // Update Redis
      await this.redis.hSet(benchmarkKey, {
        puzzleId,
        language,
        p50RuntimeMs: currentP50.toString(),
        p95RuntimeMs: currentP95.toString(),
        avgMemoryKb: currentAvgMemory.toString(),
        sampleSize: sampleSize.toString(),
        lastUpdated: new Date().toISOString(),
      });

      // Update database periodically (every 10 submissions)
      if (sampleSize % 10 === 0) {
        await this.updateDatabaseBenchmark(puzzleId, language, {
          p50RuntimeMs: Math.round(currentP50),
          p95RuntimeMs: Math.round(currentP95),
          avgMemoryKb: Math.round(currentAvgMemory),
          sampleSize,
          lastUpdated: new Date(),
        });
      }

      console.log(`Updated benchmark for ${puzzleId}:${language} - Sample: ${sampleSize}, P50: ${Math.round(currentP50)}ms`);
    } catch (error) {
      console.error('Error updating puzzle benchmark:', error);
    }
  }

  private async updateDatabaseBenchmark(
    puzzleId: string,
    language: string,
    benchmark: Omit<PuzzleBenchmark, 'puzzleId' | 'language'>
  ): Promise<void> {
    await this.prisma.puzzleBenchmark.upsert({
      where: {
        puzzleId_language: {
          puzzleId,
          language,
        },
      },
      update: benchmark,
      create: {
        puzzleId,
        language,
        ...benchmark,
      },
    });
  }

  // Get puzzle benchmark for damage calculation
  async getPuzzleBenchmark(puzzleId: string, language: string): Promise<PuzzleBenchmark | null> {
    const benchmarkKey = `puzzle:benchmark:${puzzleId}:${language}`;
    
    try {
      const benchmark = await this.redis.hGetAll(benchmarkKey);
      
      if (!benchmark.puzzleId) {
        // Try database fallback
        const dbBenchmark = await this.prisma.puzzleBenchmark.findUnique({
          where: {
            puzzleId_language: {
              puzzleId,
              language,
            },
          },
        });

        if (dbBenchmark) {
          // Cache in Redis
          await this.redis.hSet(benchmarkKey, {
            ...dbBenchmark,
            lastUpdated: dbBenchmark.lastUpdated.toISOString(),
          });
          await this.redis.expire(benchmarkKey, 3600); // 1 hour TTL
          
          return dbBenchmark;
        }
        
        return null;
      }

      return {
        puzzleId: benchmark.puzzleId,
        language: benchmark.language,
        p50RuntimeMs: parseFloat(benchmark.p50RuntimeMs),
        p95RuntimeMs: parseFloat(benchmark.p95RuntimeMs),
        avgMemoryKb: parseFloat(benchmark.avgMemoryKb),
        sampleSize: parseInt(benchmark.sampleSize),
        lastUpdated: new Date(benchmark.lastUpdated),
      };
    } catch (error) {
      console.error('Error getting puzzle benchmark:', error);
      return null;
    }
  }

  // Initialize benchmarks for existing puzzles
  async initializeBenchmarks(): Promise<void> {
    const puzzles = await this.prisma.puzzle.findMany({
      where: { isActive: true },
    });

    const languages = ['python', 'javascript', 'java', 'cpp'];

    for (const puzzle of puzzles) {
      for (const language of languages) {
        const benchmark = await this.getPuzzleBenchmark(puzzle.id, language);
        
        if (!benchmark) {
          // Create default benchmark
          const defaultBenchmark: Omit<PuzzleBenchmark, 'puzzleId' | 'language'> = {
            p50RuntimeMs: 1000, // 1 second default
            p95RuntimeMs: 2000, // 2 seconds default
            avgMemoryKb: 128, // 128MB default
            sampleSize: 0,
            lastUpdated: new Date(),
          };

          await this.updateDatabaseBenchmark(puzzle.id, language, defaultBenchmark);
          console.log(`Initialized default benchmark for ${puzzle.id}:${language}`);
        }
      }
    }
  }
}
