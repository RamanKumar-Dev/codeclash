import { ExecutionResult, DamageCalculation, BattleDamageResult, PuzzleBenchmark } from '../types';
import { DAMAGE_CONFIG } from '../config/constants';

export class DamageCalculator {
  
  calculateDamage(
    executionResult: ExecutionResult,
    elapsedSeconds: number,
    timeLimitSeconds: number,
    puzzleBenchmark?: PuzzleBenchmark,
    isFirstSolve: boolean = false
  ): DamageCalculation {
    const { passed, total, runtime_ms } = executionResult;
    const passedRatio = total > 0 ? passed / total : 0;

    // Base damage calculation
    const baseDamage = DAMAGE_CONFIG.BASE_DAMAGE * passedRatio;

    // Speed multiplier (0.5x to 1x)
    const speedMultiplier = Math.max(
      DAMAGE_CONFIG.SPEED_MIN_MULTIPLIER,
      1 - (elapsedSeconds / timeLimitSeconds)
    );

    // Efficiency bonus (if runtime is better than p50 benchmark)
    let efficiencyBonus = 0;
    if (puzzleBenchmark && runtime_ms < puzzleBenchmark.p50_runtime_ms) {
      efficiencyBonus = DAMAGE_CONFIG.EFFICIENCY_BONUS;
    }

    // All test cases pass bonus
    const allPassBonus = passed === total && total > 0 ? DAMAGE_CONFIG.ALL_PASS_BONUS : 0;

    // First solve bonus
    const firstSolveBonus = isFirstSolve ? DAMAGE_CONFIG.FIRST_SOLVE_BONUS : 0;

    // Calculate total damage
    const totalDamage = (baseDamage * speedMultiplier) + efficiencyBonus + allPassBonus + firstSolveBonus;

    // Partial damage for each test case passed (even if overall solution fails)
    const partialDamage = passed * DAMAGE_CONFIG.PARTIAL_DAMAGE_PER_TEST;

    // Apply damage cap
    const cappedDamage = Math.min(totalDamage, DAMAGE_CONFIG.MAX_DAMAGE);

    return {
      baseDamage,
      speedMultiplier,
      efficiencyBonus,
      allPassBonus,
      firstSolveBonus,
      totalDamage,
      partialDamage,
      cappedDamage,
    };
  }

  calculateBattleDamage(
    userId: string,
    roomId: string,
    executionResult: ExecutionResult,
    elapsedSeconds: number,
    timeLimitSeconds: number,
    opponentHp: number,
    puzzleBenchmark?: PuzzleBenchmark,
    isFirstSolve: boolean = false
  ): BattleDamageResult {
    const damageBreakdown = this.calculateDamage(
      executionResult,
      elapsedSeconds,
      timeLimitSeconds,
      puzzleBenchmark,
      isFirstSolve
    );

    const finalDamage = damageBreakdown.cappedDamage;
    const newOpponentHp = Math.max(0, opponentHp - finalDamage);
    const isBattleOver = newOpponentHp <= 0;

    return {
      userId,
      roomId,
      damage: finalDamage,
      executionResult,
      damageBreakdown,
      opponentHp: newOpponentHp,
      isBattleOver,
      winner: isBattleOver ? userId : undefined,
    };
  }

  async updatePuzzleBenchmark(
    puzzleId: string,
    language: string,
    runtimeMs: number,
    prisma: any
  ): Promise<PuzzleBenchmark | null> {
    try {
      // Get current benchmark or create new one
      const existing = await prisma.puzzleBenchmark.findUnique({
        where: {
          puzzleId_language: {
            puzzleId,
            language
          }
        }
      });

      if (!existing) {
        // Create new benchmark
        const newBenchmark = await prisma.puzzleBenchmark.create({
          data: {
            puzzleId,
            language,
            p50_runtime_ms: runtimeMs,
            sampleSize: 1,
          }
        });
        return newBenchmark;
      }

      // Update existing benchmark with new sample
      const newSampleSize = existing.sampleSize + 1;
      
      // Simple running average for p50 (median would be more accurate but requires more storage)
      const newP50 = ((existing.p50_runtime_ms * existing.sampleSize) + runtimeMs) / newSampleSize;

      const updatedBenchmark = await prisma.puzzleBenchmark.update({
        where: { id: existing.id },
        data: {
          p50_runtime_ms: Math.round(newP50),
          sampleSize: newSampleSize,
          updatedAt: new Date(),
        }
      });

      return updatedBenchmark;
    } catch (error) {
      console.error('Error updating puzzle benchmark:', error);
      return null;
    }
  }

  getDamageDescription(damageBreakdown: DamageCalculation): string {
    const parts: string[] = [];
    
    if (damageBreakdown.baseDamage > 0) {
      parts.push(`Base: ${damageBreakdown.baseDamage.toFixed(1)}`);
    }
    
    if (damageBreakdown.speedMultiplier < 1) {
      parts.push(`Speed: ${damageBreakdown.speedMultiplier.toFixed(2)}x`);
    }
    
    if (damageBreakdown.efficiencyBonus > 0) {
      parts.push(`Efficiency: +${damageBreakdown.efficiencyBonus}`);
    }
    
    if (damageBreakdown.allPassBonus > 0) {
      parts.push(`All tests: +${damageBreakdown.allPassBonus}`);
    }
    
    if (damageBreakdown.firstSolveBonus > 0) {
      parts.push(`First solve: +${damageBreakdown.firstSolveBonus}`);
    }

    if (damageBreakdown.partialDamage > 0 && damageBreakdown.baseDamage === 0) {
      parts.push(`Partial: ${damageBreakdown.partialDamage}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No damage';
  }

  validateDamageLimits(damage: number): boolean {
    return damage >= 0 && damage <= DAMAGE_CONFIG.MAX_DAMAGE;
  }

  getMaxDamage(): number {
    return DAMAGE_CONFIG.MAX_DAMAGE;
  }

  getStartingHp(): number {
    return DAMAGE_CONFIG.STARTING_HP;
  }
}
