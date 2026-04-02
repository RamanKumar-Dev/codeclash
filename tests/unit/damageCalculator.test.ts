import { DamageCalculator } from '../services/judge/src/services/damageCalculator';

describe('DamageCalculator', () => {
  let damageCalculator: DamageCalculator;

  beforeEach(() => {
    damageCalculator = new DamageCalculator();
  });

  describe('calculateBattleDamage', () => {
    it('should calculate correct damage for perfect solution', () => {
      const executionResult = {
        passed: 5,
        total: 5,
        runtime_ms: 1000,
        memory_kb: 128,
        statusCode: 3, // Success
        statusDescription: 'Success',
        testCaseResults: [],
        correctnessRatio: 1.0,
      };

      const damage = damageCalculator.calculateBattleDamage(
        'user1',
        'room1',
        executionResult,
        10, // elapsedSeconds
        30, // timeLimitSeconds
        100, // opponentHp
        null, // puzzleBenchmark
        false // isFirstSolve
      );

      expect(damage.damage).toBeGreaterThan(0);
      expect(damage.damage).toBeLessThanOrEqual(70); // MAX_DAMAGE
      expect(damage.opponentHp).toBe(100 - damage.damage);
      expect(damage.isBattleOver).toBe(false);
    });

    it('should give bonus for first solve', () => {
      const executionResult = {
        passed: 5,
        total: 5,
        runtime_ms: 1000,
        memory_kb: 128,
        statusCode: 3,
        statusDescription: 'Success',
        testCaseResults: [],
        correctnessRatio: 1.0,
      };

      const damage = damageCalculator.calculateBattleDamage(
        'user1',
        'room1',
        executionResult,
        10,
        30,
        100,
        null,
        true // isFirstSolve
      );

      expect(damage.damageBreakdown.firstSolveBonus).toBe(25);
    });

    it('should calculate reduced damage for partial solutions', () => {
      const executionResult = {
        passed: 3,
        total: 5,
        runtime_ms: 1000,
        memory_kb: 128,
        statusCode: 4, // Wrong answer
        statusDescription: 'Wrong Answer',
        testCaseResults: [],
        correctnessRatio: 0.6,
      };

      const damage = damageCalculator.calculateBattleDamage(
        'user1',
        'room1',
        executionResult,
        10,
        30,
        100,
        null,
        false
      );

      expect(damage.damage).toBeLessThan(70); // Should be less than max damage
      expect(damage.executionResult.correctnessRatio).toBe(0.6);
    });

    it('should detect battle over when opponent HP reaches 0', () => {
      const executionResult = {
        passed: 5,
        total: 5,
        runtime_ms: 1000,
        memory_kb: 128,
        statusCode: 3,
        statusDescription: 'Success',
        testCaseResults: [],
        correctnessRatio: 1.0,
      };

      const damage = damageCalculator.calculateBattleDamage(
        'user1',
        'room1',
        executionResult,
        10,
        30,
        10, // Low opponent HP
        null,
        false
      );

      if (damage.damage >= 10) {
        expect(damage.isBattleOver).toBe(true);
        expect(damage.winner).toBe('user1');
      }
    });
  });

  describe('updatePuzzleBenchmark', () => {
    it('should update benchmark for better performance', async () => {
      const mockPrisma = {
        puzzleBenchmark: {
          upsert: jest.fn().mockResolvedValue({}),
        },
      } as any;

      await damageCalculator.updatePuzzleBenchmark(
        'puzzle1',
        'python',
        500, // Better runtime
        mockPrisma
      );

      expect(mockPrisma.puzzleBenchmark.upsert).toHaveBeenCalled();
    });
  });
});
