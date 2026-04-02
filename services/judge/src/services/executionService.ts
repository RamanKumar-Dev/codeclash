import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';
import { Judge0Client } from './judge0Client';
import { DamageCalculator } from './damageCalculator';
import { RateLimitService } from './rateLimitService';
import { validateSecurityConstraints, SECURITY_CONFIG } from './securityService';
import { 
  ExecutionRequest, 
  ExecutionResult, 
  BattleDamageResult, 
  TestCase,
  PuzzleBenchmark 
} from '../types';

export class ExecutionService {
  private judge0Client: Judge0Client;
  private damageCalculator: DamageCalculator;
  private prisma: PrismaClient;
  private redis: RedisClientType;
  private rateLimitService: RateLimitService;

  constructor(prisma: PrismaClient, redis: RedisClientType) {
    this.prisma = prisma;
    this.redis = redis;
    this.judge0Client = new Judge0Client();
    this.damageCalculator = new DamageCalculator();
    this.rateLimitService = new RateLimitService(redis);
  }

  async executeCode(request: ExecutionRequest): Promise<BattleDamageResult> {
    const { code, language, puzzleId, userId, roomId, submissionId } = request;

    try {
      console.log(`Executing code for user ${userId} in room ${roomId}, puzzle ${puzzleId}`);

      // 0. Security validation and rate limiting
      const securityCheck = validateSecurityConstraints(code, language);
      if (!securityCheck.valid) {
        throw new Error(`Security validation failed: ${securityCheck.errors.join(', ')}`);
      }

      const rateLimitCheck = await this.rateLimitService.checkSubmissionRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000)} seconds`);
      }

      // 1. Fetch puzzle and test cases
      const puzzle = await this.prisma.problem.findUnique({
        where: { id: puzzleId },
        select: {
          id: true,
          title: true,
          difficulty: true,
          testCases: true,
          timeLimitMs: true,
        }
      });

      if (!puzzle) {
        throw new Error(`Puzzle not found: ${puzzleId}`);
      }

      const testCases: TestCase[] = puzzle.testCases as TestCase[];
      if (!testCases || testCases.length === 0) {
        throw new Error(`No test cases found for puzzle: ${puzzleId}`);
      }

      // 2. Get battle state for timing
      const battleState = await this.getBattleState(roomId);
      if (!battleState) {
        throw new Error(`Battle state not found for room: ${roomId}`);
      }

      const startTime = parseInt(battleState.startTime || Date.now().toString());
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const timeLimitSeconds = puzzle.timeLimitMs / 1000;

      // 3. Execute code against test cases
      const executionStartTime = Date.now();
      const testCaseResults = await this.judge0Client.submitBatch(code, language, testCases);
      const executionEndTime = Date.now();

      // 4. Calculate execution results
      const passed = testCaseResults.filter(result => result.passed).length;
      const total = testCaseResults.length;
      const avgRuntime = testCaseResults.reduce((sum, result) => sum + result.runtime_ms, 0) / total;
      const maxMemory = Math.max(...testCaseResults.map(result => result.memory_kb));

      const executionResult: ExecutionResult = {
        passed,
        total,
        runtime_ms: Math.round(avgRuntime),
        memory_kb: maxMemory,
        statusCode: testCaseResults[0]?.statusCode || 0,
        statusDescription: testCaseResults[0]?.statusDescription || 'Unknown',
        testCaseResults,
        correctnessRatio: total > 0 ? passed / total : 0,
      };

      // 5. Get puzzle benchmark for efficiency bonus
      const puzzleBenchmark = await this.getPuzzleBenchmark(puzzleId, language);

      // 6. Check if this is first solve (all tests passed for first time in this battle)
      const isFirstSolve = await this.checkFirstSolve(roomId, userId, passed === total);

      // 7. Get opponent HP
      const opponentHp = await this.getOpponentHp(roomId, userId);

      // 8. Calculate damage
      const battleDamage = this.damageCalculator.calculateBattleDamage(
        userId,
        roomId,
        executionResult,
        elapsedSeconds,
        timeLimitSeconds,
        opponentHp,
        puzzleBenchmark,
        isFirstSolve
      );

      // 9. Update puzzle benchmark if solution was successful
      if (passed === total && executionResult.runtime_ms > 0) {
        await this.damageCalculator.updatePuzzleBenchmark(
          puzzleId,
          language,
          executionResult.runtime_ms,
          this.prisma
        );
      }

      // 10. Store submission in database
      await this.storeSubmission(request, executionResult, battleDamage.damage);

      // 11. Update battle state in Redis
      await this.updateBattleState(roomId, userId, battleDamage);

      // 12. Emit battle damage event
      await this.emitBattleDamage(battleDamage);

      console.log(`Execution completed for user ${userId}: damage=${battleDamage.damage}, opponentHp=${battleDamage.opponentHp}`);

      return battleDamage;

    } catch (error) {
      console.error('Error executing code:', error);
      throw error;
    }
  }

  private async getBattleState(roomId: string): Promise<any> {
    try {
      const battleKey = `battle:${roomId}`;
      return await this.redis.hGetAll(battleKey);
    } catch (error) {
      console.error('Error getting battle state:', error);
      return null;
    }
  }

  private async getPuzzleBenchmark(puzzleId: string, language: string): Promise<PuzzleBenchmark | null> {
    try {
      const benchmark = await this.prisma.puzzleBenchmark.findUnique({
        where: {
          puzzleId_language: {
            puzzleId,
            language
          }
        }
      });

      return benchmark;
    } catch (error) {
      console.error('Error getting puzzle benchmark:', error);
      return null;
    }
  }

  private async checkFirstSolve(roomId: string, userId: string, allTestsPassed: boolean): Promise<boolean> {
    if (!allTestsPassed) return false;

    try {
      // Check if anyone has already passed all tests in this battle
      const firstSolveKey = `battle:${roomId}:first_solve`;
      const existingFirstSolve = await this.redis.get(firstSolveKey);

      if (existingFirstSolve) {
        return false; // Someone already solved it first
      }

      // Mark this user as first solver
      await this.redis.set(firstSolveKey, userId, { EX: 3600 }); // 1 hour expiry
      return true;
    } catch (error) {
      console.error('Error checking first solve:', error);
      return false;
    }
  }

  private async getOpponentHp(roomId: string, userId: string): Promise<number> {
    try {
      const battleState = await this.getBattleState(roomId);
      
      // Determine which HP field belongs to the opponent
      const isPlayer1 = battleState.player1Id === userId;
      const opponentHpField = isPlayer1 ? 'player2Hp' : 'player1Hp';
      
      return parseInt(battleState[opponentHpField] || '100');
    } catch (error) {
      console.error('Error getting opponent HP:', error);
      return 100; // Default HP
    }
  }

  private async storeSubmission(
    request: ExecutionRequest, 
    executionResult: ExecutionResult, 
    damage: number
  ): Promise<void> {
    try {
      await this.prisma.submission.create({
        data: {
          id: request.submissionId,
          matchId: request.roomId,
          userId: request.userId,
          problemId: request.puzzleId,
          code: request.code,
          language: request.language,
          passedTests: executionResult.passed,
          totalTests: executionResult.total,
          execTimeMs: executionResult.runtime_ms,
          damageDealt: damage,
          createdAt: new Date(),
        }
      });
    } catch (error) {
      console.error('Error storing submission:', error);
      // Don't throw here - execution can continue even if DB storage fails
    }
  }

  private async updateBattleState(roomId: string, userId: string, battleDamage: BattleDamageResult): Promise<void> {
    try {
      const battleKey = `battle:${roomId}`;
      
      // Get current battle state to determine which player to update
      const battleState = await this.getBattleState(roomId);
      const isPlayer1 = battleState.player1Id === userId;
      
      // Update opponent's HP
      const opponentHpField = isPlayer1 ? 'player2Hp' : 'player1Hp';
      await this.redis.hSet(battleKey, {
        [opponentHpField]: battleDamage.opponentHp.toString()
      });

      // Update submission counts
      const submissionField = isPlayer1 ? 'player1Submissions' : 'player2Submissions';
      await this.redis.hIncrBy(battleKey, submissionField, 1);

      // Update lines changed (simple heuristic based on code length)
      const linesField = isPlayer1 ? 'player1LinesChanged' : 'player2LinesChanged';
      const linesChanged = battleDamage.executionResult.testCaseResults.length;
      await this.redis.hIncrBy(battleKey, linesField, linesChanged);

      console.log(`Updated battle state for room ${roomId}: opponentHp=${battleDamage.opponentHp}`);

    } catch (error) {
      console.error('Error updating battle state:', error);
      throw error;
    }
  }

  private async emitBattleDamage(battleDamage: BattleDamageResult): Promise<void> {
    try {
      // This would typically emit via Socket.io to the battle room
      // For now, we'll store the event in Redis for the battle service to pick up
      const damageEventKey = `battle:${battleDamage.roomId}:damage_event`;
      const eventData = {
        userId: battleDamage.userId,
        damage: battleDamage.damage,
        opponentHp: battleDamage.opponentHp,
        executionResult: {
          passed: battleDamage.executionResult.passed,
          total: battleDamage.executionResult.total,
          runtime_ms: battleDamage.executionResult.runtime_ms,
        },
        damageBreakdown: battleDamage.damageBreakdown,
        isBattleOver: battleDamage.isBattleOver,
        winner: battleDamage.winner,
        timestamp: Date.now(),
      };

      await this.redis.setEx(damageEventKey, 300, JSON.stringify(eventData)); // 5 minutes expiry
      
      console.log(`Emitted damage event for room ${battleDamage.roomId}`);

    } catch (error) {
      console.error('Error emitting battle damage:', error);
      // Don't throw here - the battle can continue even if event emission fails
    }
  }

  async getExecutionHistory(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const submissions = await this.prisma.submission.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          problem: {
            select: { title: true, difficulty: true }
          }
        }
      });

      return submissions;
    } catch (error) {
      console.error('Error getting execution history:', error);
      return [];
    }
  }

  async healthCheck(): Promise<{ judge0: boolean; database: boolean; redis: boolean }> {
    const judge0Healthy = await this.judge0Client.healthCheck();
    
    let databaseHealthy = false;
    let redisHealthy = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseHealthy = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    try {
      await this.redis.ping();
      redisHealthy = true;
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    return {
      judge0: judge0Healthy,
      database: databaseHealthy,
      redis: redisHealthy,
    };
  }
}
