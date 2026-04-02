import { Server, Socket } from 'socket.io';
import { createClient, RedisClientType } from 'redis';
import axios from 'axios';
import { 
  BattleState, 
  BattleSubmitEvent, 
  BattleForfeitEvent,
  BattleDamageEvent,
  BattleEndEvent,
  Puzzle
} from '@code-clash/shared-types/mvp-types';
import { UserService } from './userService';
import { ProblemService } from './problemService';

export class BattleService {
  private io: Server;
  private redis: RedisClientType;
  private judge0Url: string;

  constructor(io: Server, redis: RedisClientType) {
    this.io = io;
    this.redis = redis;
    this.judge0Url = process.env.JUDGE0_URL || 'http://localhost:2358';
  }

  // Handle battle submission
  async handleSubmit(socket: Socket, data: BattleSubmitEvent): Promise<void> {
    const { code, languageId, roomId } = data;
    const userId = (socket as any).userId;

    try {
      // Validate room ownership
      const battleState = await this.getBattleState(roomId);
      if (!battleState || !this.isPlayerInBattle(userId, battleState)) {
        socket.emit('error', 'Not authorized for this battle');
        return;
      }

      // Update submission count
      const isPlayer1 = battleState.player1Id === userId;
      if (isPlayer1) {
        battleState.sub1Count++;
      } else {
        battleState.sub2Count++;
      }

      // Update Redis state
      await this.redis.setEx(`battle:${roomId}`, 2400, JSON.stringify(battleState));

      // Notify opponent of activity
      socket.to(roomId).emit('battle:opponent_activity', {
        submissionCount: isPlayer1 ? battleState.sub1Count : battleState.sub2Count
      });

      // Set battle to JUDGING status
      battleState.status = 'JUDGING';
      await this.redis.setEx(`battle:${roomId}`, 2400, JSON.stringify(battleState));

      // Get puzzle data
      const puzzle = await this.getPuzzleData(battleState);
      if (!puzzle) {
        socket.emit('error', 'Puzzle not found');
        return;
      }

      // Execute code with Judge0
      const results = await this.executeCode(code, languageId, puzzle.testCases);

      // Calculate damage
      const damage = this.calculateDamage(results, battleState, puzzle);

      // Update HP
      if (isPlayer1) {
        battleState.hp2 = Math.max(0, battleState.hp2 - damage);
      } else {
        battleState.hp1 = Math.max(0, battleState.hp1 - damage);
      }

      // Update Redis state
      battleState.status = 'ACTIVE';
      await this.redis.setEx(`battle:${roomId}`, 2400, JSON.stringify(battleState));

      // Emit damage event
      const attackerName = await this.getUserName(userId);
      this.io.to(roomId).emit('battle:damage', {
        attackerName,
        damage,
        hp1: battleState.hp1,
        hp2: battleState.hp2,
      } as BattleDamageEvent);

      // Check win condition
      if (battleState.hp1 <= 0 || battleState.hp2 <= 0) {
        await this.endBattle(roomId, battleState);
      }

    } catch (error) {
      console.error('Error handling submission:', error);
      socket.emit('error', 'Failed to execute code');
      
      // Reset battle state to ACTIVE
      const battleState = await this.getBattleState(roomId);
      if (battleState) {
        battleState.status = 'ACTIVE';
        await this.redis.setEx(`battle:${roomId}`, 2400, JSON.stringify(battleState));
      }
    }
  }

  // Execute code using Judge0
  private async executeCode(code: string, languageId: number, testCases: any[]): Promise<any> {
    const results = [];

    for (const testCase of testCases) {
      try {
        const submission = {
          language_id: languageId,
          source_code: code,
          stdin: testCase.input,
          expected_output: testCase.expectedOutput,
          cpu_time_limit: 5, // 5 seconds
          memory_limit: 256000, // 256MB
          max_output_size: 64000, // 64KB
          wait: true, // Synchronous mode for MVP
        };

        const response = await axios.post(`${this.judge0Url}/submissions`, submission);
        const token = response.data.token;

        // Get results (wait=true makes this synchronous, but we'll still poll for safety)
        const result = await this.getJudge0Result(token);

        results.push({
          passed: result.status.id === 3 && result.stdout?.trim() === testCase.expectedOutput.trim(),
          runtime_ms: result.time || 0,
          output: result.stdout,
          stderr: result.stderr,
        });
      } catch (error) {
        console.error('Error executing test case:', error);
        results.push({
          passed: false,
          runtime_ms: 0,
          output: '',
          stderr: 'Execution error',
        });
      }
    }

    return results;
  }

  // Get Judge0 result
  private async getJudge0Result(token: string): Promise<any> {
    try {
      const response = await axios.get(`${this.judge0Url}/submissions/${token}`);
      return response.data;
    } catch (error) {
      console.error('Error getting Judge0 result:', error);
      throw error;
    }
  }

  // Calculate damage based on results
  private calculateDamage(results: any[], battleState: BattleState, puzzle: Puzzle): number {
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const elapsedSec = (Date.now() - battleState.startTimestamp) / 1000;
    const timeLimitSec = puzzle.timeLimitSeconds;

    if (passedCount === 0) {
      return 0;
    } else if (passedCount < totalCount) {
      return passedCount * 3; // Chip damage
    } else {
      // All passed
      const speedMult = Math.max(0.5, 1 - (elapsedSec / timeLimitSec));
      const avgRuntime = results.reduce((sum, r) => sum + r.runtime_ms, 0) / results.length;
      const efficiencyBonus = avgRuntime < puzzle.p50RuntimeMs ? 10 : 0;
      
      let damage = Math.round((50 * speedMult) + efficiencyBonus);
      return Math.min(damage, 60); // Cap at 60
    }
  }

  // Handle forfeit
  async handleForfeit(socket: Socket, data: BattleForfeitEvent): Promise<void> {
    const { roomId } = data;
    const userId = (socket as any).userId;

    try {
      const battleState = await this.getBattleState(roomId);
      if (!battleState || !this.isPlayerInBattle(userId, battleState)) {
        socket.emit('error', 'Not authorized for this battle');
        return;
      }

      // Set winner to opponent
      const winnerId = battleState.player1Id === userId ? battleState.player2Id : battleState.player1Id;
      
      // Set HP to 0 for forfeiter
      if (battleState.player1Id === userId) {
        battleState.hp1 = 0;
      } else {
        battleState.hp2 = 0;
      }

      await this.endBattle(roomId, battleState, winnerId);
    } catch (error) {
      console.error('Error handling forfeit:', error);
      socket.emit('error', 'Failed to forfeit battle');
    }
  }

  // Start battle countdown
  async startCountdown(roomId: string): Promise<void> {
    const battleState = await this.getBattleState(roomId);
    if (!battleState || battleState.status !== 'WAITING') {
      return;
    }

    battleState.status = 'COUNTDOWN';
    await this.redis.setEx(`battle:${roomId}`, 2400, JSON.stringify(battleState));

    // Emit countdown
    this.io.to(roomId).emit('battle:countdown', { secondsLeft: 3 });

    setTimeout(() => {
      this.io.to(roomId).emit('battle:countdown', { secondsLeft: 2 });
    }, 1000);

    setTimeout(() => {
      this.io.to(roomId).emit('battle:countdown', { secondsLeft: 1 });
    }, 2000);

    setTimeout(() => {
      this.startBattle(roomId);
    }, 3000);
  }

  // Start battle
  async startBattle(roomId: string): Promise<void> {
    const battleState = await this.getBattleState(roomId);
    if (!battleState) return;

    battleState.status = 'ACTIVE';
    battleState.startTimestamp = Date.now();
    await this.redis.setEx(`battle:${roomId}`, 2400, JSON.stringify(battleState));

    // Get puzzle data
    const puzzle = await this.getPuzzleData(battleState);
    if (!puzzle) return;

    // Emit battle start
    this.io.to(roomId).emit('battle:start');

    // Schedule time warning
    setTimeout(() => {
      this.io.to(roomId).emit('battle:time_warning', { secondsLeft: 60 });
    }, (puzzle.timeLimitSeconds - 60) * 1000);

    // Schedule battle end
    setTimeout(() => {
      this.endBattleOnTime(roomId);
    }, puzzle.timeLimitSeconds * 1000);
  }

  // End battle on time
  private async endBattleOnTime(roomId: string): Promise<void> {
    const battleState = await this.getBattleState(roomId);
    if (!battleState || battleState.status !== 'ACTIVE') {
      return;
    }

    await this.endBattle(roomId, battleState);
  }

  // End battle
  private async endBattle(roomId: string, battleState: BattleState, winnerId?: string): Promise<void> {
    if (!winnerId) {
      winnerId = battleState.hp1 > battleState.hp2 ? battleState.player1Id : battleState.player2Id;
    }

    const loserId = winnerId === battleState.player1Id ? battleState.player2Id : battleState.player1Id;

    // Calculate ELO change (simplified K=32)
    const eloChange = 32;

    battleState.status = 'ENDED';
    await this.redis.setEx(`battle:${roomId}`, 2400, JSON.stringify(battleState));

    // Update user stats in database
    try {
      await UserService.updateBattleStats(winnerId, loserId, eloChange, -eloChange);
      console.log(`Battle ended: Winner ${winnerId}, Loser ${loserId}, ELO change ${eloChange}`);
    } catch (error) {
      console.error('Error updating battle stats:', error);
    }

    // Emit battle end
    const winnerName = await this.getUserName(winnerId);
    this.io.to(roomId).emit('battle:end', {
      winnerId,
      winnerName,
      finalHp1: battleState.hp1,
      finalHp2: battleState.hp2,
      eloChange,
    } as BattleEndEvent);

    // Clean up Redis after delay
    setTimeout(() => {
      this.redis.del(`battle:${roomId}`);
    }, 10000); // 10 seconds
  }

  // Helper methods
  private async getBattleState(roomId: string): Promise<BattleState | null> {
    try {
      const stateJson = await this.redis.get(`battle:${roomId}`);
      return stateJson ? JSON.parse(stateJson) : null;
    } catch (error) {
      console.error('Error getting battle state:', error);
      return null;
    }
  }

  private async getPuzzleData(battleState: BattleState): Promise<Puzzle | null> {
    try {
      // Get a random puzzle from the database
      const problem = await ProblemService.getRandomProblem();
      if (!problem) {
        console.error('No puzzles found in database');
        return null;
      }

      // Parse JSON fields from database
      const examples = problem.examples as any[] || [];
      const testCases = problem.testCases as any[] || [];

      // Convert Problem to Puzzle format for MVP
      return {
        id: problem.id,
        title: problem.title,
        description: problem.description,
        difficulty: problem.difficulty as 1 | 2 | 3,
        examples: examples.map((ex: any) => ({
          input: ex.input,
          output: ex.output
        })),
        testCases: testCases.map((tc: any) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden
        })),
        timeLimitSeconds: Math.floor(problem.timeLimitMs / 1000),
        p50RuntimeMs: problem.p50RuntimeMs || problem.timeLimitMs / 2, // Use p50 from DB or fallback
      };
    } catch (error) {
      console.error('Error getting puzzle data:', error);
      return null;
    }
  }

  private isPlayerInBattle(userId: string, battleState: BattleState): boolean {
    return battleState.player1Id === userId || battleState.player2Id === userId;
  }

  private async getUserName(userId: string): Promise<string> {
    try {
      const user = await UserService.getUserById(userId);
      return user?.username || `User${userId.substr(0, 4)}`;
    } catch (error) {
      console.error('Error getting user name:', error);
      return `User${userId.substr(0, 4)}`;
    }
  }
}
