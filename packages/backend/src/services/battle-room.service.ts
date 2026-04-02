import { 
  BattleRoom, 
  BattleParticipant, 
  BattleState, 
  BattleStateData, 
  DamageLog, 
  BattleStats,
  Problem,
  MATCHMAKING_CONFIG 
} from '@code-clash/shared-types';
import { redisService } from './redis.service';
import { judgeService } from './judge.service';
import { SpellUnlockService } from './spell-unlock.service';
import { v4 as uuidv4 } from 'uuid';

export class BattleRoomService {
  private battleTimers = new Map<string, NodeJS.Timeout>();
  private countdownTimers = new Map<string, NodeJS.Timeout>();
  private spellUnlockService: SpellUnlockService;

  constructor() {
    this.spellUnlockService = new SpellUnlockService();
  }

  // Initialize battle room
  async initializeBattle(roomId: string, puzzle: Problem): Promise<void> {
    try {
      const battleState = await redisService.getBattleState(roomId);
      if (!battleState) {
        throw new Error('Battle state not found');
      }

      // Update battle state with puzzle
      battleState.puzzle = puzzle;
      await redisService.updateBattleState(roomId, battleState);

      // Update room state to WAITING
      await redisService.updateBattleRoom(roomId, { state: 'WAITING' });

      // Start countdown when both players are ready
      await this.waitForPlayersReady(roomId);

      console.log(`Battle room ${roomId} initialized with puzzle ${puzzle.id}`);
    } catch (error) {
      console.error('Error initializing battle:', error);
      throw error;
    }
  }

  // Wait for both players to be ready
  private async waitForPlayersReady(roomId: string): Promise<void> {
    const checkReady = async (): Promise<boolean> => {
      const participants = await redisService.getBattleParticipants(roomId);
      return participants.every(p => !p.isDisconnected);
    };

    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 1000; // 1 second
    let elapsed = 0;

    const readyCheck = setInterval(async () => {
      elapsed += checkInterval;
      
      if (await checkReady()) {
        clearInterval(readyCheck);
        await this.startCountdown(roomId);
      } else if (elapsed >= maxWaitTime) {
        clearInterval(readyCheck);
        await this.endBattleDueToNoShow(roomId);
      }
    }, checkInterval);
  }

  // Start countdown before battle begins
  private async startCountdown(roomId: string): Promise<void> {
    await redisService.updateBattleRoom(roomId, { state: 'COUNTDOWN' });

    let countdown = 3;
    await redisService.publish(`battle:${roomId}:countdown`, { seconds: countdown });

    const countdownInterval = setInterval(async () => {
      countdown--;
      
      if (countdown > 0) {
        await redisService.publish(`battle:${roomId}:countdown`, { seconds: countdown });
      } else {
        clearInterval(countdownInterval);
        await this.startBattle(roomId);
      }
    }, 1000);

    this.countdownTimers.set(roomId, countdownInterval);
  }

  // Start active battle
  private async startBattle(roomId: string): Promise<void> {
    try {
      const battleState = await redisService.getBattleState(roomId);
      if (!battleState) {
        throw new Error('Battle state not found');
      }

      // Update room state
      await redisService.updateBattleRoom(roomId, { 
        state: 'ACTIVE',
        startedAt: new Date(),
      });

      // Update battle state
      battleState.timeRemaining = battleState.room.timeLimit;
      await redisService.updateBattleState(roomId, battleState);

      // Start battle timer
      this.startBattleTimer(roomId);

      // Notify players
      await redisService.publish(`battle:${roomId}:start`, {
        puzzle: battleState.puzzle,
        timeLimit: battleState.room.timeLimit,
        opponentName: battleState.player2.username,
        opponentElo: battleState.player2.elo,
      });

      console.log(`Battle started in room ${roomId}`);
    } catch (error) {
      console.error('Error starting battle:', error);
    }
  }

  // Battle timer management
  private startBattleTimer(roomId: string): void {
    const timer = setInterval(async () => {
      try {
        const battleState = await redisService.getBattleState(roomId);
        if (!battleState || battleState.room.state !== 'ACTIVE') {
          clearInterval(timer);
          this.battleTimers.delete(roomId);
          return;
        }

        battleState.timeRemaining -= 1000; // Decrease by 1 second

        // Check for time warning
        if (battleState.timeRemaining === 60000) { // 1 minute warning
          await redisService.publish(`battle:${roomId}:time_warning`, { secondsLeft: 60 });
        }

        // Check for battle end
        if (battleState.timeRemaining <= 0) {
          clearInterval(timer);
          this.battleTimers.delete(roomId);
          await this.endBattle(roomId);
        } else {
          await redisService.updateBattleState(roomId, battleState);
        }
      } catch (error) {
        console.error('Error in battle timer:', error);
        clearInterval(timer);
        this.battleTimers.delete(roomId);
      }
    }, 1000);

    this.battleTimers.set(roomId, timer);
  }

  // Handle code submission
  async handleSubmission(roomId: string, userId: string, code: string, language: string): Promise<void> {
    try {
      const battleState = await redisService.getBattleState(roomId);
      if (!battleState || battleState.room.state !== 'ACTIVE') {
        throw new Error('Battle not active');
      }

      // Update participant submission count
      const participant = battleState.player1.userId === userId ? battleState.player1 : battleState.player2;
      participant.submissions++;
      participant.lastActivity = new Date();
      
      await redisService.updateParticipant(roomId, userId, participant);

      // Set battle to judging state
      await redisService.updateBattleRoom(roomId, { state: 'JUDGING' });
      await redisService.updateBattleState(roomId, battleState);

      // Notify opponent about submission
      const opponentId = battleState.player1.userId === userId ? battleState.player2.userId : battleState.player1.userId;
      await redisService.publish(`battle:${roomId}:opponent_progress`, {
        linesChanged: code.split('\n').length,
        submissionCount: participant.submissions,
      });

      // Judge the submission
      const judgeResult = await judgeService.judgeSubmission({
        code,
        language,
        puzzle: battleState.puzzle,
      });

      // Calculate damage
      const damage = await this.calculateDamage(judgeResult, battleState, userId);

      // Apply damage to opponent
      const opponent = battleState.player1.userId === opponentId ? battleState.player1 : battleState.player2;
      const oldHp = opponent.hp;
      opponent.hp = Math.max(0, opponent.hp - damage);
      
      await redisService.updateParticipant(roomId, opponentId, opponent);

      // Create damage log
      const damageLog: DamageLog = {
        id: uuidv4(),
        sourcePlayer: userId,
        targetPlayer: opponentId,
        damage,
        type: 'puzzle',
        timestamp: new Date(),
        details: judgeResult,
      };

      // Store damage log (in a real implementation, this would go to a database)
      await this.storeDamageLog(roomId, damageLog);

      // Notify players about damage — include targetPlayer so the frontend knows which HP bar to update
      await redisService.publish(`battle:${roomId}:damage`, {
        sourcePlayer: userId,
        targetPlayer: opponentId,
        damage,
        targetHP: opponent.hp,
        attackAnimation: damage > 40 ? 'critical' : damage > 20 ? 'normal' : 'light',
      });

      // Check for battle end
      if (opponent.hp <= 0) {
        await this.endBattle(roomId, userId);
      } else {
        // Resume battle
        await redisService.updateBattleRoom(roomId, { state: 'ACTIVE' });
        battleState.timeRemaining = battleState.room.timeLimit - (Date.now() - battleState.room.startedAt!.getTime());
        await redisService.updateBattleState(roomId, battleState);
      }

      console.log(`Submission processed in room ${roomId}: ${userId} dealt ${damage} damage to ${opponentId}`);
    } catch (error) {
      console.error('Error handling submission:', error);
      // Resume battle on error
      await redisService.updateBattleRoom(roomId, { state: 'ACTIVE' });
    }
  }

  // Handle spell casting
  async handleSpellCast(roomId: string, userId: string, spellType: string, targetUserId?: string): Promise<void> {
    try {
      const battleState = await redisService.getBattleState(roomId);
      if (!battleState || battleState.room.state !== 'ACTIVE') {
        throw new Error('Battle not active');
      }

      const caster = battleState.player1.userId === userId ? battleState.player1 : battleState.player2;
      
      // Check mana cost (simplified)
      const manaCost = this.getSpellManaCost(spellType);
      if (caster.mana < manaCost) {
        throw new Error('Insufficient mana');
      }

      // Deduct mana
      caster.mana -= manaCost;
      await redisService.updateParticipant(roomId, userId, caster);

      // Apply spell effect
      const effect = await this.applySpellEffect(roomId, spellType, userId, targetUserId);

      // Notify players
      await redisService.publish(`battle:${roomId}:spell_used`, {
        caster: userId,
        spellType,
        effect,
      });

      console.log(`Spell cast in room ${roomId}: ${userId} used ${spellType}`);
    } catch (error) {
      console.error('Error handling spell cast:', error);
    }
  }

  // Handle player disconnection
  async handleDisconnection(roomId: string, userId: string): Promise<void> {
    try {
      // Mark as disconnected
      await redisService.setParticipantDisconnected(roomId, userId, true);

      // Notify opponent
      const battleState = await redisService.getBattleState(roomId);
      if (battleState) {
        const opponentId = battleState.player1.userId === userId ? battleState.player2.userId : battleState.player1.userId;
        await redisService.publish(`battle:${roomId}:reconnecting`, { opponentId: userId });
      }

      // Start reconnection timeout
      setTimeout(async () => {
        const isStillDisconnected = await redisService.isParticipantDisconnected(roomId, userId);
        if (isStillDisconnected) {
          await this.endBattleDueToDisconnection(roomId, userId);
        }
      }, MATCHMAKING_CONFIG.RECONNECT_TIMEOUT);

      console.log(`Player ${userId} disconnected from battle room ${roomId}`);
    } catch (error) {
      console.error('Error handling disconnection:', error);
    }
  }

  // Handle reconnection
  async handleReconnection(roomId: string, userId: string): Promise<void> {
    try {
      // Mark as reconnected
      await redisService.setParticipantDisconnected(roomId, userId, false);

      // Notify opponent
      await redisService.publish(`battle:${roomId}:opponent_reconnected`, {});

      // Send current battle state to reconnected player
      const battleState = await redisService.getBattleState(roomId);
      if (battleState) {
        await redisService.publish(`battle:${userId}:state_update`, battleState);
      }

      console.log(`Player ${userId} reconnected to battle room ${roomId}`);
    } catch (error) {
      console.error('Error handling reconnection:', error);
    }
  }

  // Handle forfeit
  async handleForfeit(roomId: string, userId: string): Promise<void> {
    try {
      await this.endBattle(roomId, userId === (await redisService.getBattleRoom(roomId))?.player1Id ? 
        (await redisService.getBattleRoom(roomId))?.player2Id : userId);
    } catch (error) {
      console.error('Error handling forfeit:', error);
    }
  }

  // End battle
  private async endBattle(roomId: string, winnerId?: string): Promise<void> {
    try {
      const battleState = await redisService.getBattleState(roomId);
      if (!battleState) return;

      // Clear timers
      const battleTimer = this.battleTimers.get(roomId);
      const countdownTimer = this.countdownTimers.get(roomId);
      
      if (battleTimer) clearInterval(battleTimer);
      if (countdownTimer) clearInterval(countdownTimer);
      
      this.battleTimers.delete(roomId);
      this.countdownTimers.delete(roomId);

      // Determine winner if not specified
      if (!winnerId) {
        winnerId = battleState.player1.hp > battleState.player2.hp ? battleState.player1.userId : battleState.player2.userId;
      }

      const loserId = winnerId === battleState.player1.userId ? battleState.player2.userId : battleState.player1.userId;

      // Calculate battle stats
      const battleStats: BattleStats = {
        winner: winnerId,
        loser: loserId,
        duration: battleState.room.startedAt ? Date.now() - battleState.room.startedAt.getTime() : 0,
        totalSubmissions: battleState.player1.submissions + battleState.player2.submissions,
        damageLog: await this.getDamageLogs(roomId),
        eloChange: await this.calculateEloChange(winnerId, loserId, battleState),
        rewards: this.calculateRewards(winnerId, loserId, battleState),
      };

      // Update room state
      await redisService.updateBattleRoom(roomId, { 
        state: 'ENDED',
        endedAt: new Date(),
      });

      // Notify players
      await redisService.publish(`battle:${roomId}:end`, battleStats);

      // Check for spell unlocks
      const spellUnlocks = await this.spellUnlockService.checkAndAwardSpells(winnerId, loserId);
      
      // Notify players of new spell unlocks
      for (const unlock of spellUnlocks) {
        await redisService.publish(`spell:unlocked:${unlock.userId}`, unlock);
      }

      // Cleanup after delay
      setTimeout(async () => {
        await redisService.deleteBattleRoom(roomId);
      }, 5000); // 5 seconds cleanup delay

      console.log(`Battle ended in room ${roomId}: ${winnerId} defeated ${loserId}`);
    } catch (error) {
      console.error('Error ending battle:', error);
    }
  }

  // End battle due to no show
  private async endBattleDueToNoShow(roomId: string): Promise<void> {
    try {
      const participants = await redisService.getBattleParticipants(roomId);
      const presentPlayer = participants.find(p => !p.isDisconnected);
      
      if (presentPlayer) {
        await this.endBattle(roomId, presentPlayer.userId);
      } else {
        // No players showed up, just delete the room
        await redisService.deleteBattleRoom(roomId);
      }
    } catch (error) {
      console.error('Error ending battle due to no show:', error);
    }
  }

  // End battle due to disconnection
  private async endBattleDueToDisconnection(roomId: string, disconnectedUserId: string): Promise<void> {
    try {
      const participants = await redisService.getBattleParticipants(roomId);
      const connectedPlayer = participants.find(p => p.userId !== disconnectedUserId);
      
      if (connectedPlayer) {
        await this.endBattle(roomId, connectedPlayer.userId);
      }
    } catch (error) {
      console.error('Error ending battle due to disconnection:', error);
    }
  }

  // Utility methods
  private async calculateDamage(judgeResult: any, battleState: BattleStateData, userId: string): Promise<number> {
    const total = judgeResult.total || 1;
    const passed = judgeResult.passed || 0;
    const passRatio = passed / total;

    // Speed multiplier: faster = more bonus (runtime_ms < benchmark)
    const runtimeMs = judgeResult.executionTime ?? 2000;
    const speedMultiplier = runtimeMs < 500 ? 1.5 : runtimeMs < 1000 ? 1.2 : runtimeMs < 2000 ? 1.0 : 0.8;

    let damage = 20 * passRatio * speedMultiplier;

    // All-pass bonus
    if (passed === total && total > 0) damage += 15;

    // First-solve bonus: no previous passing submission from this player
    if (passed === total && battleState.player1.userId === userId ? battleState.player1.submissions === 1 : battleState.player2.submissions === 1) {
      damage += 20;
    }

    // Check for active Double Damage spell
    const doubleDmgKey = `double_damage:${battleState.room.id}:${userId}`;
    const doubleDmgActive = await redisService.get(doubleDmgKey);
    if (doubleDmgActive) {
      damage *= 2;
      await redisService.del(doubleDmgKey); // consume once
    }

    return Math.min(Math.round(damage), 70); // cap at 70 HP
  }

  private getSpellManaCost(spellType: string): number {
    const costs = {
      'hint': 10,
      'time_freeze': 20,
      'slow': 15,
      'oracle_hint': 30,
      'tower_shield': 40,
      'debug_ray': 50,
      'double_damage': 60,
      'code_wipe': 70,
    };
    return costs[spellType as keyof typeof costs] || 10;
  }

  async applySpellEffect(roomId: string, spellType: string, casterId: string, targetId?: string): Promise<any> {
    // Enhanced spell effects based on new spell system
    switch (spellType) {
      case 'oracle_hint':
        // Reveal one hidden test case
        const battleState = await redisService.getBattleState(roomId);
        if (battleState && battleState.puzzle) {
          const hiddenTestCases = battleState.puzzle.testCases.filter(tc => tc.isHidden);
          if (hiddenTestCases.length > 0) {
            const randomTestCase = hiddenTestCases[Math.floor(Math.random() * hiddenTestCases.length)];
            return { 
              type: 'oracle_hint', 
              testCase: randomTestCase,
              message: 'Hidden test case revealed!'
            };
          }
        }
        return { type: 'oracle_hint', message: 'No hidden test cases found' };

      case 'time_freeze':
        // Pause battle timer for 15 seconds
        const timeBattleState = await redisService.getBattleState(roomId);
        if (timeBattleState) {
          // Store frozen time and set up unfreeze timer
          const frozenTime = timeBattleState.timeRemaining;
          await redisService.updateBattleState(roomId, { 
            ...timeBattleState,
            timeRemaining: frozenTime // Keep same time, but timer won't count down
          });
          
          // Unfreeze after 15 seconds
          setTimeout(async () => {
            const currentState = await redisService.getBattleState(roomId);
            if (currentState && currentState.room.state === 'ACTIVE') {
              await redisService.updateBattleState(roomId, currentState);
            }
          }, 15000);
          
          return { type: 'time_freeze', duration: 15, message: 'Time frozen for 15 seconds!' };
        }
        return { type: 'time_freeze', message: 'Failed to freeze time' };

      case 'tower_shield':
        // Add shield effect to target
        const targetUserId = targetId || casterId;
        const participants = await redisService.getBattleParticipants(roomId);
        const targetParticipant = participants.find(p => p.userId === targetUserId);
        
        if (targetParticipant) {
          // Store shield value in participant data or active effects
          await redisService.updateParticipant(roomId, targetUserId, {
            ...targetParticipant,
            // Add shield property (would need to extend BattleParticipant interface)
            shield: (targetParticipant as any).shield ? (targetParticipant as any).shield + 50 : 50
          });
          
          return { type: 'tower_shield', value: 50, targetId: targetUserId, message: 'Tower Shield activated!' };
        }
        return { type: 'tower_shield', message: 'Target not found' };

      case 'debug_ray':
        // Force compile error on opponent's next submission
        const rayTargetId = targetId || (casterId === battleState?.player1.userId ? battleState.player2.userId : battleState?.player1.userId);
        if (rayTargetId) {
          // Set debug ray effect on target
          const debugKey = `debug_ray:${roomId}:${rayTargetId}`;
          await redisService.setex(debugKey, 300, 'active'); // 5 minute duration
          
          return { type: 'debug_ray', targetId: rayTargetId, message: 'Debug Ray cast!' };
        }
        return { type: 'debug_ray', message: 'No target available' };

      case 'double_damage':
        // Next submission deals 2x damage
        await redisService.setex(`double_damage:${roomId}:${casterId}`, 300, 'active');
        return { type: 'double_damage', value: 2, message: 'Double Damage activated!' };

      case 'code_wipe':
        // Clear opponent's output panel
        const wipeTargetId = targetId || (casterId === battleState?.player1.userId ? battleState.player2.userId : battleState?.player1.userId);
        if (wipeTargetId) {
          // Emit code wipe effect to client
          await redisService.publish(`battle:${roomId}:code_wipe`, { targetId: wipeTargetId });
          return { type: 'code_wipe', targetId: wipeTargetId, message: 'Code Wipe cast!' };
        }
        return { type: 'code_wipe', message: 'No target available' };

      default:
        return { type: 'unknown', message: 'Unknown spell effect' };
    }
  }

  private async storeDamageLog(roomId: string, damageLog: DamageLog): Promise<void> {
    // In a real implementation, this would store in a database
    // For now, we'll store in Redis with a TTL
    const key = `battle:${roomId}:damage_logs`;
    await redisService.client.lpush(key, JSON.stringify(damageLog));
    await redisService.client.expire(key, 3600); // 1 hour TTL
  }

  private async getDamageLogs(roomId: string): Promise<DamageLog[]> {
    const key = `battle:${roomId}:damage_logs`;
    const logs = await redisService.client.lrange(key, 0, -1);
    return logs.map(log => JSON.parse(log));
  }

  private async calculateEloChange(winnerId: string, loserId: string, battleState: BattleStateData): Promise<{ winner: number; loser: number }> {
    // Simplified ELO calculation
    const winner = battleState.player1.userId === winnerId ? battleState.player1 : battleState.player2;
    const loser = battleState.player1.userId === loserId ? battleState.player1 : battleState.player2;
    
    const eloDiff = loser.elo - winner.elo;
    const kFactor = 32;
    const expectedScore = 1 / (1 + Math.pow(10, eloDiff / 400));
    const eloChange = Math.round(kFactor * (1 - expectedScore));
    
    return {
      winner: eloChange,
      loser: -eloChange,
    };
  }

  private calculateRewards(winnerId: string, loserId: string, battleState: BattleStateData): any {
    return {
      winner: { xp: 100, tokens: 10 },
      loser: { xp: 25, tokens: 2 },
    };
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.battleTimers.values()) {
      clearInterval(timer);
    }
    for (const timer of this.countdownTimers.values()) {
      clearInterval(timer);
    }
    
    this.battleTimers.clear();
    this.countdownTimers.clear();
  }
}

export const battleRoomService = new BattleRoomService();
