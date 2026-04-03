import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
import { JudgeService } from './judgeService';
import { UserService } from './userService';
import { AchievementService } from './achievementService';

interface BattleState {
  player1Id: string;
  player2Id: string;
  problemId: string;
  hp1: number;
  hp2: number;
  startTimestamp: number;
  status: 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'JUDGING' | 'ENDED';
  sub1Count: number;
  sub2Count: number;
  matchId?: string;
  timeLimitSeconds?: number;
  lastHeartbeat?: number; // Add heartbeat for crash recovery
}

const INITIAL_HP = 500;
const ELO_K_FACTOR = 32;

export class BattleService {
  private io: Server;
  private redis: RedisClientType;
  private socketRegistry: Map<string, Socket>;

  constructor(io: Server, redis: RedisClientType, socketRegistry: Map<string, Socket>) {
    this.io = io;
    this.redis = redis;
    this.socketRegistry = socketRegistry;
  }

  /** Public accessor used by spell handler in index.ts */
  async getBattleStatePublic(roomId: string): Promise<BattleState | null> {
    return this.getBattleState(roomId);
  }

  /** Check for orphaned battles on server startup */
  async checkOrphanedBattles(): Promise<void> {
    try {
      const battleKeys = await this.redis.keys('battle:*');
      const now = Date.now();
      const heartbeatTimeout = 2 * 60 * 1000; // 2 minutes
      
      for (const key of battleKeys) {
        const battleState = await this.redis.get(key);
        if (battleState) {
          const battle = JSON.parse(battleState) as BattleState;
          
          // Check if battle is active and heartbeat is expired
          if (battle.status === 'ACTIVE' && 
              battle.lastHeartbeat && 
              (now - battle.lastHeartbeat) > heartbeatTimeout) {
            
            console.log(`[Recovery] Found orphaned battle: ${key.replace('battle:', '')}`);
            
            // Auto-forfeit the battle - both players lose due to server crash
            battle.hp1 = 0;
            battle.hp2 = 0;
            battle.status = 'ENDED';
            
            await this.saveBattleState(key.replace('battle:', ''), battle);
            
            // Notify both players if they're online
            const socket1 = this.socketRegistry.get(battle.player1Id);
            const socket2 = this.socketRegistry.get(battle.player2Id);
            
            const notification = {
              reason: 'server_crash',
              message: 'Battle ended due to server restart'
            };
            
            if (socket1) {
              socket1.emit('battle:crash_recovery', notification);
            }
            if (socket2) {
              socket2.emit('battle:crash_recovery', notification);
            }
            
            console.log(`[Recovery] Auto-forfeited orphaned battle: ${key.replace('battle:', '')}`);
          }
        }
      }
      
      console.log(`[Recovery] Checked ${battleKeys.length} battles for orphaned states`);
    } catch (error) {
      console.error('[Recovery] Error checking orphaned battles:', error);
    }
  }

  /** Get test cases for a battle's problem (used for hint spells) */
  async getPuzzleTestCases(roomId: string): Promise<Array<{ input: string; expectedOutput: string }>> {
    const state = await this.getBattleState(roomId);
    if (!state) return [];
    try {
      const { prisma } = await import('../lib/prisma');
      const problem = await prisma.problem.findUnique({
        where: { id: state.problemId },
        select: { testCases: true },
      });
      const tcs = (problem?.testCases as unknown as any[]) || [];
      return tcs.map((tc: any) => ({ input: tc.input, expectedOutput: tc.expectedOutput }));
    } catch {
      return [];
    }
  }

  /** Handle code submission with distributed lock */
  async handleSubmit(
    socket: Socket,
    data: { code: string; languageId: number; roomId: string; userId: string }
  ): Promise<void> {
    const { code, languageId, roomId, userId } = data;
    const lockKey = `submission:lock:${userId}`;
    const lockTimeout = 10; // 10 seconds lock timeout

    try {
      // Acquire distributed lock to prevent simultaneous submissions
      const lockAcquired = await this.acquireDistributedLock(lockKey, lockTimeout);
      if (!lockAcquired) {
        socket.emit('submit:error', 'Please wait for your previous submission to complete');
        return;
      }

      const battleState = await this.getBattleState(roomId);
      if (!battleState) { 
        await this.releaseDistributedLock(lockKey);
        socket.emit('submit:error', 'Battle not found'); 
        return; 
      }
      if (!this.isPlayerInBattle(userId, battleState)) { 
        await this.releaseDistributedLock(lockKey);
        socket.emit('submit:error', 'Not in this battle'); 
        return; 
      }
      if (battleState.status !== 'ACTIVE') { 
        await this.releaseDistributedLock(lockKey);
        socket.emit('submit:error', 'Battle not active'); 
        return; 
      }

      const isPlayer1 = battleState.player1Id === userId;

      // Track submission count
      if (isPlayer1) battleState.sub1Count++;
      else battleState.sub2Count++;

      battleState.status = 'JUDGING';
      await this.saveBattleState(roomId, battleState);

      // Notify opponent of activity
      socket.to(roomId).emit('battle:opponent_activity', {
        submissionCount: isPlayer1 ? battleState.sub1Count : battleState.sub2Count,
      });

      // Emit judging started to submitter
      socket.emit('submit:judging', { message: 'Running test cases...' });

      // Get problem + test cases
      const { problem, testCases } = await this.getProblemData(battleState.problemId);
      if (!problem || testCases.length === 0) {
        socket.emit('submit:error', 'Problem data not found');
        battleState.status = 'ACTIVE';
        await this.saveBattleState(roomId, battleState);
        await this.releaseDistributedLock(lockKey);
        return;
      }

      // Run judge
      const judgeSummary = await JudgeService.judge(code, languageId, testCases);
      const elapsedMs = Date.now() - battleState.startTimestamp;
      const timeLimitMs = (problem.timeLimitMs || 300000);

      // Calculate damage
      const damage = this.calculateDamage(judgeSummary, elapsedMs, timeLimitMs, problem.p50RuntimeMs || 1000);

      // Apply damage
      if (damage > 0) {
        if (isPlayer1) battleState.hp2 = Math.max(0, battleState.hp2 - damage);
        else battleState.hp1 = Math.max(0, battleState.hp1 - damage);
      }

      battleState.status = 'ACTIVE';
      await this.saveBattleState(roomId, battleState);

      // Get usernames for display
      const [attacker, target] = await Promise.all([
        UserService.getUserById(userId),
        UserService.getUserById(isPlayer1 ? battleState.player2Id : battleState.player1Id),
      ]);

      // Emit result to submitter
      socket.emit('submit:result', {
        passed: judgeSummary.passedTests === judgeSummary.totalTests,
        passedTests: judgeSummary.passedTests,
        totalTests: judgeSummary.totalTests,
        damage,
        avgRuntimeMs: Math.round(judgeSummary.avgRuntimeMs),
        results: judgeSummary.results.map(r => ({
          passed: r.passed,
          runtimeMs: r.runtimeMs,
          error: r.error,
          // Don't expose hidden test case outputs
        })),
      });

      // Broadcast damage event to room
      if (damage > 0) {
        const attackerName = attacker?.username || 'Unknown';
        this.io.to(roomId).emit('battle:damage', {
          attackerName,
          damage,
          hp1: battleState.hp1,
          hp2: battleState.hp2,
          passedTests: judgeSummary.passedTests,
          totalTests: judgeSummary.totalTests,
        });
      } else {
        // No damage — inform room
        this.io.to(roomId).emit('battle:no_damage', {
          attackerName: attacker?.username || 'Unknown',
          passedTests: judgeSummary.passedTests,
          totalTests: judgeSummary.totalTests,
        });
      }

      // Save submission to DB
      try {
        await this.saveSubmission({
          matchId: battleState.matchId,
          userId,
          problemId: battleState.problemId,
          code,
          language: this.languageIdToName(languageId),
          passedTests: judgeSummary.passedTests,
          totalTests: judgeSummary.totalTests,
          execTimeMs: Math.round(judgeSummary.avgRuntimeMs),
          damageDealt: damage,
        });
      } catch (e) {
        console.error('[Battle] Failed to save submission:', e);
      }

      // Check win condition
      if (battleState.hp1 <= 0 || battleState.hp2 <= 0) {
        await this.endBattle(roomId, battleState);
      }

    } catch (error) {
      console.error('[Battle] Submit error:', error);
      socket.emit('submit:error', 'Execution failed');
      // Reset to ACTIVE
      const s = await this.getBattleState(roomId);
      if (s && s.status === 'JUDGING') {
        s.status = 'ACTIVE';
        await this.saveBattleState(roomId, s);
      }
    } finally {
      // Always release the lock
      await this.releaseDistributedLock(lockKey);
    }
  }

  /** Handle forfeit */
  async handleForfeit(
    socket: Socket,
    data: { roomId: string; userId: string }
  ): Promise<void> {
    const { roomId, userId } = data;
    try {
      const battleState = await this.getBattleState(roomId);
      if (!battleState || !this.isPlayerInBattle(userId, battleState)) {
        socket.emit('error', 'Not in this battle');
        return;
      }

      const isPlayer1 = battleState.player1Id === userId;
      if (isPlayer1) battleState.hp1 = 0;
      else battleState.hp2 = 0;

      await this.endBattle(roomId, battleState, isPlayer1 ? battleState.player2Id : battleState.player1Id);
    } catch (e) {
      console.error('[Battle] Forfeit error:', e);
    }
  }

  /** Start countdown (called from index.ts socket event) */
  async startCountdown(roomId: string): Promise<void> {
    const battleState = await this.getBattleState(roomId);
    if (!battleState || battleState.status !== 'WAITING') return;

    battleState.status = 'COUNTDOWN';
    await this.saveBattleState(roomId, battleState);

    for (let i = 3; i >= 1; i--) {
      setTimeout(() => {
        this.io.to(roomId).emit('battle:countdown', { secondsLeft: i });
      }, (3 - i) * 1000);
    }

    setTimeout(async () => {
      battleState.status = 'ACTIVE';
      battleState.startTimestamp = Date.now();
      await this.saveBattleState(roomId, battleState);
      this.io.to(roomId).emit('battle:start');
    }, 3000);
  }

  /** End a battle and update ELO */
  private async endBattle(
    roomId: string,
    battleState: BattleState,
    overrideWinnerId?: string
  ): Promise<void> {
    const winnerId = overrideWinnerId || (
      battleState.hp1 > battleState.hp2 ? battleState.player1Id : battleState.player2Id
    );
    const loserId = winnerId === battleState.player1Id
      ? battleState.player2Id
      : battleState.player1Id;

    battleState.status = 'ENDED';
    await this.saveBattleState(roomId, battleState);

    try {
      // Get current ELOs for proper calculation
      const [winner, loser] = await Promise.all([
        UserService.getUserById(winnerId),
        UserService.getUserById(loserId),
      ]);

      const winnerElo = winner?.elo || 1000;
      const loserElo = loser?.elo || 1000;
      const { winnerChange, loserChange } = this.calculateEloChange(winnerElo, loserElo, winner?.wins || 0, loser?.wins || 0);

      await UserService.updateBattleStats(winnerId, loserId, winnerChange, loserChange);

      // Check achievements
      const battleDurationMs = Date.now() - battleState.startTimestamp;
      const winnerDamageReceived = winnerId === battleState.player1Id
        ? INITIAL_HP - battleState.hp1
        : INITIAL_HP - battleState.hp2;

      const [winnerUser] = await Promise.all([UserService.getUserById(winnerId)]);
      const newAchievements = await AchievementService.checkAndGrant(winnerId, {
        wins: (winnerUser?.wins || 0) + 1,
        losses: winnerUser?.losses || 0,
        winStreak: (winnerUser as any)?.winStreak || 0,
        battleDurationMs,
        damageReceived: winnerDamageReceived,
        firstWin: (winnerUser?.wins || 0) === 0,
      });

      // Update winner streak
      await UserService.incrementWinStreak(winnerId);
      await UserService.resetWinStreak(loserId);

      // Notify room
      this.io.to(roomId).emit('battle:end', {
        winnerId,
        winnerName: winner?.username || 'Unknown',
        loserId,
        finalHp1: battleState.hp1,
        finalHp2: battleState.hp2,
        winnerEloChange: winnerChange,
        loserEloChange: loserChange,
        newAchievements: newAchievements.map(a => ({ id: a.id, name: a.name, icon: a.icon })),
      });

      // Clean up Redis after 30s
      setTimeout(() => this.redis.del(`battle:${roomId}`), 30000);

      console.log(`[Battle] End: ${winner?.username} wins +${winnerChange} ELO`);

    } catch (e) {
      console.error('[Battle] End error:', e);
    }
  }

  /** Proper ELO calculation: K × (actual − expected) */
  private calculateEloChange(
    winnerElo: number,
    loserElo: number,
    winnerGames: number,
    loserGames: number,
  ): { winnerChange: number; loserChange: number } {
    const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));

    // K factor decreases as you play more games
    const winnerK = winnerGames < 30 ? 40 : winnerGames < 100 ? 32 : 24;
    const loserK = loserGames < 30 ? 40 : loserGames < 100 ? 32 : 24;

    const winnerChange = Math.round(winnerK * (1 - expected));
    const loserChange = Math.round(loserK * (0 - (1 - expected)));

    return { winnerChange: Math.max(1, winnerChange), loserChange: Math.min(-1, loserChange) };
  }

  /** Damage calculation */
  private calculateDamage(
    judgeSummary: { passedTests: number; totalTests: number; avgRuntimeMs: number },
    elapsedMs: number,
    timeLimitMs: number,
    p50RuntimeMs: number
  ): number {
    const { passedTests, totalTests, avgRuntimeMs } = judgeSummary;

    if (passedTests === 0) return 0;

    if (passedTests < totalTests) {
      // Partial: chip damage = 5 per test passed
      return passedTests * 5;
    }

    // All passed — full damage formula
    // Speed multiplier: 1.0 at start, 0.5 at time limit
    const speedMult = Math.max(0.5, 1 - (elapsedMs / timeLimitMs) * 0.5);

    // Efficiency bonus: fast solution gets up to +30
    const efficiencyBonus = avgRuntimeMs < p50RuntimeMs
      ? Math.round(30 * (1 - avgRuntimeMs / p50RuntimeMs))
      : 0;

    const baseDamage = 80;
    const damage = Math.round(baseDamage * speedMult) + efficiencyBonus;

    return Math.min(damage, 120); // Cap at 120
  }

  /** Helpers */
  private async getBattleState(roomId: string): Promise<BattleState | null> {
    const raw = await this.redis.get(`battle:${roomId}`);
    return raw ? JSON.parse(raw) : null;
  }

  private async saveBattleState(roomId: string, state: BattleState): Promise<void> {
    // Update heartbeat on every save
    state.lastHeartbeat = Date.now();
    await this.redis.setEx(`battle:${roomId}`, 7200, JSON.stringify(state));
  }

  private isPlayerInBattle(userId: string, state: BattleState): boolean {
    return state.player1Id === userId || state.player2Id === userId;
  }

  private async getProblemData(problemId: string) {
    try {
      const { prisma } = await import('../lib/prisma');
      const problem = await prisma.problem.findUnique({
        where: { id: problemId },
      });
      if (!problem) return { problem: null, testCases: [] };

      const testCases = (problem.testCases as unknown as any[]).map((tc: any) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden || false,
      }));

      return { problem, testCases };
    } catch (e) {
      console.error('[Battle] getProblemData error:', e);
      return { problem: null, testCases: [] };
    }
  }

  private async saveSubmission(data: {
    matchId?: string;
    userId: string;
    problemId: string;
    code: string;
    language: string;
    passedTests: number;
    totalTests: number;
    execTimeMs: number;
    damageDealt: number;
  }) {
    if (!data.matchId) return;
    const { prisma } = await import('../lib/prisma');
    await prisma.submission.create({ data: data as any });
  }

  private languageIdToName(id: number): string {
    const map: Record<number, string> = {
      63: 'javascript', 71: 'python', 54: 'cpp', 62: 'java',
      74: 'typescript', 68: 'php', 72: 'ruby', 60: 'go',
    };
    return map[id] || 'unknown';
  }

  /** Redis Distributed Lock Implementation */
  private async acquireDistributedLock(lockKey: string, timeoutSeconds: number): Promise<boolean> {
    try {
      const lockValue = `${Date.now()}-${Math.random()}`;
      const result = await this.redis.set(
        lockKey, 
        lockValue, 
        {
          NX: true, // Only set if key doesn't exist
          EX: timeoutSeconds // Auto-expire after timeout
        }
      );
      
      if (result === 'OK') {
        // Store lock value for later release
        await this.redis.setEx(`${lockKey}:value`, timeoutSeconds, lockValue);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Lock] Error acquiring lock:', error);
      return false;
    }
  }

  private async releaseDistributedLock(lockKey: string): Promise<void> {
    try {
      const lockValue = await this.redis.get(`${lockKey}:value`);
      if (!lockValue) return;
      
      // Use Lua script for atomic lock release
      const luaScript = `
        if redis.call("get", "${lockKey}:value") == "${lockValue}" then
          return redis.call("del", "${lockKey}")
        else
          return 0
        end
      `;
      
      await this.redis.eval(luaScript);
      await this.redis.del(`${lockKey}:value`);
    } catch (error) {
      console.error('[Lock] Error releasing lock:', error);
    }
  }
}
