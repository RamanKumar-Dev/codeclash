import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DamageCalculator } from '../src/services/damageCalculator';

describe('DamageCalculator', () => {
  let damageCalculator: DamageCalculator;

  beforeEach(() => {
    damageCalculator = new DamageCalculator();
  });

  describe('calculateDamage', () => {
    it('should calculate maximum damage for perfect solution', () => {
      const executionResult = {
        passed: 10,
        total: 10,
        runtime_ms: 500,
        memory_kb: 128,
        statusCode: 3,
        statusDescription: 'Success',
        testCaseResults: [],
        correctnessRatio: 1.0,
      };

      const result = damageCalculator.calculateDamage(
        executionResult,
        30, // elapsed seconds
        300, // time limit seconds
        { p50_runtime_ms: 800, puzzleId: 'test', language: 'python', sampleSize: 10, updatedAt: new Date() },
        true // first solve
      );

      expect(result.cappedDamage).toBeLessThanOrEqual(70);
      expect(result.baseDamage).toBe(20);
      expect(result.speedMultiplier).toBeGreaterThan(0.5);
      expect(result.efficiencyBonus).toBe(10);
      expect(result.allPassBonus).toBe(15);
      expect(result.firstSolveBonus).toBe(25);
    });

    it('should calculate partial damage for incomplete solution', () => {
      const executionResult = {
        passed: 6,
        total: 10,
        runtime_ms: 1200,
        memory_kb: 256,
        statusCode: 4,
        statusDescription: 'Wrong Answer',
        testCaseResults: [],
        correctnessRatio: 0.6,
      };

      const result = damageCalculator.calculateDamage(
        executionResult,
        120, // elapsed seconds
        300, // time limit seconds
        undefined, // no benchmark
        false // not first solve
      );

      expect(result.partialDamage).toBe(12); // 6 * 2 HP per test
      expect(result.allPassBonus).toBe(0);
      expect(result.firstSolveBonus).toBe(0);
    });

    it('should apply speed multiplier correctly', () => {
      const executionResult = {
        passed: 10,
        total: 10,
        runtime_ms: 500,
        memory_kb: 128,
        statusCode: 3,
        statusDescription: 'Success',
        testCaseResults: [],
        correctnessRatio: 1.0,
      };

      // Test with different elapsed times
      const fastResult = damageCalculator.calculateDamage(executionResult, 30, 300);
      const slowResult = damageCalculator.calculateDamage(executionResult, 200, 300);

      expect(fastResult.speedMultiplier).toBeGreaterThan(slowResult.speedMultiplier);
      expect(fastResult.speedMultiplier).toBeLessThanOrEqual(1.0);
      expect(slowResult.speedMultiplier).toBeGreaterThanOrEqual(0.5);
    });

    it('should cap damage at maximum limit', () => {
      const executionResult = {
        passed: 10,
        total: 10,
        runtime_ms: 100, // Very fast
        memory_kb: 64,
        statusCode: 3,
        statusDescription: 'Success',
        testCaseResults: [],
        correctnessRatio: 1.0,
      };

      const result = damageCalculator.calculateDamage(
        executionResult,
        10, // Very fast
        300,
        { p50_runtime_ms: 1000, puzzleId: 'test', language: 'python', sampleSize: 10, updatedAt: new Date() },
        true
      );

      expect(result.cappedDamage).toBeLessThanOrEqual(70);
    });

    it('should handle edge cases', () => {
      const emptyResult = {
        passed: 0,
        total: 0,
        runtime_ms: 0,
        memory_kb: 0,
        statusCode: 0,
        statusDescription: 'Unknown',
        testCaseResults: [],
        correctnessRatio: 0,
      };

      const result = damageCalculator.calculateDamage(
        emptyResult,
        0,
        300,
        undefined,
        false
      );

      expect(result.cappedDamage).toBe(0);
      expect(result.baseDamage).toBe(0);
    });
  });

  describe('calculateBattleDamage', () => {
    it('should calculate battle damage with opponent HP update', () => {
      const executionResult = {
        passed: 8,
        total: 10,
        runtime_ms: 600,
        memory_kb: 128,
        statusCode: 3,
        statusDescription: 'Success',
        testCaseResults: [],
        correctnessRatio: 0.8,
      };

      const result = damageCalculator.calculateBattleDamage(
        'user1',
        'room1',
        executionResult,
        60,
        300,
        500, // opponent HP
        undefined,
        false
      );

      expect(result.userId).toBe('user1');
      expect(result.roomId).toBe('room1');
      expect(result.opponentHp).toBeLessThan(500);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.isBattleOver).toBe(false);
    });

    it('should detect battle over when opponent HP reaches 0', () => {
      const executionResult = {
        passed: 10,
        total: 10,
        runtime_ms: 100,
        memory_kb: 64,
        statusCode: 3,
        statusDescription: 'Success',
        testCaseResults: [],
        correctnessRatio: 1.0,
      };

      const result = damageCalculator.calculateBattleDamage(
        'user1',
        'room1',
        executionResult,
        10,
        300,
        50, // Low opponent HP
        { p50_runtime_ms: 1000, puzzleId: 'test', language: 'python', sampleSize: 10, updatedAt: new Date() },
        true
      );

      expect(result.isBattleOver).toBe(true);
      expect(result.winner).toBe('user1');
      expect(result.opponentHp).toBeLessThanOrEqual(0);
    });
  });

  describe('validateDamageLimits', () => {
    it('should validate damage within limits', () => {
      expect(damageCalculator.validateDamageLimits(50)).toBe(true);
      expect(damageCalculator.validateDamageLimits(70)).toBe(true);
      expect(damageCalculator.validateDamageLimits(0)).toBe(true);
    });

    it('should reject damage outside limits', () => {
      expect(damageCalculator.validateDamageLimits(-1)).toBe(false);
      expect(damageCalculator.validateDamageLimits(71)).toBe(false);
      expect(damageCalculator.validateDamageLimits(100)).toBe(false);
    });
  });

  describe('getDamageDescription', () => {
    it('should format damage description correctly', () => {
      const damageBreakdown = {
        baseDamage: 20,
        speedMultiplier: 0.8,
        efficiencyBonus: 10,
        allPassBonus: 15,
        firstSolveBonus: 0,
        totalDamage: 41,
        partialDamage: 0,
        cappedDamage: 41,
      };

      const description = damageCalculator.getDamageDescription(damageBreakdown);
      
      expect(description).toContain('Base: 20');
      expect(description).toContain('Speed: 0.8x');
      expect(description).toContain('Efficiency: +10');
      expect(description).toContain('All tests: +15');
    });

    it('should handle partial damage description', () => {
      const damageBreakdown = {
        baseDamage: 0,
        speedMultiplier: 1,
        efficiencyBonus: 0,
        allPassBonus: 0,
        firstSolveBonus: 0,
        totalDamage: 0,
        partialDamage: 12,
        cappedDamage: 12,
      };

      const description = damageCalculator.getDamageDescription(damageBreakdown);
      
      expect(description).toContain('Partial: 12');
    });
  });
});
