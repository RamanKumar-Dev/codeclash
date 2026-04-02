import Redis from 'redis';
import { PrismaClient, MatchStatus, SpellType } from '@prisma/client';
import { Server as SocketIOServer, Socket } from 'socket.io';

export interface BattleState {
  player1Hp: number;
  player2Hp: number;
  player1Submissions: number;
  player2Submissions: number;
  player1LinesChanged: number;
  player2LinesChanged: number;
  status: MatchStatus;
  startTime: number;
  timeLimit: number;
  player1Disconnected?: boolean;
  player2Disconnected?: boolean;
}

export interface BattleEvent {
  type: 'start' | 'countdown' | 'submit' | 'spell_cast' | 'damage' | 'time_warning' | 'end' | 'reconnect';
  data: any;
  timestamp: number;
}

export class BattleService {
  private redis: Redis.RedisClientType;
  private prisma: PrismaClient;
  private io: SocketIOServer;
  private battleTimers: Map<string, NodeJS.Timeout> = new Map();
  private countdownTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(redis: Redis.RedisClientType, prisma: PrismaClient, io: SocketIOServer) {
    this.redis = redis;
    this.prisma = prisma;
    this.io = io;
  }

  async handleBattleConnection(socket: Socket, userId: string): Promise<void> {
    // Find any active battles for this user
    const activeBattles = await this.prisma.match.findMany({
      where: {
        OR: [
          { player1Id: userId, status: { in: ['WAITING', 'COUNTDOWN', 'ACTIVE'] } },
          { player2Id: userId, status: { in: ['WAITING', 'COUNTDOWN', 'ACTIVE'] } }
        ]
      }
    });

    if (activeBattles.length > 0) {
      const battle = activeBattles[0];
      socket.join(battle.id);
      
      // Check if this is a reconnection
      const battleState = await this.getBattleState(battle.id);
      if (battleState && (battleState.player1Disconnected || battleState.player2Disconnected)) {
        await this.handleReconnection(battle.id, userId, socket);
      }
    }
  }

  async startBattleCountdown(roomId: string): Promise<void> {
    try {
      // Update battle status to COUNTDOWN
      await this.updateBattleStatus(roomId, 'COUNTDOWN');
      
      // Emit countdown start to both players
      this.io.to(roomId).emit('battle:countdown', { countdown: 3 });

      // Start 3-second countdown
      let countdown = 3;
      const countdownInterval = setInterval(async () => {
        countdown--;
        
        if (countdown > 0) {
          this.io.to(roomId).emit('battle:countdown', { countdown });
        } else {
          clearInterval(countdownInterval);
          await this.startBattle(roomId);
        }
      }, 1000);

      this.countdownTimers.set(roomId, countdownInterval);

    } catch (error) {
      console.error('Error starting battle countdown:', error);
    }
  }

  async startBattle(roomId: string): Promise<void> {
    try {
      // Get battle details
      const battle = await this.prisma.match.findUnique({
        where: { id: roomId },
        include: {
          player1: { select: { username: true, rank: true } },
          player2: { select: { username: true, rank: true } },
          problem: true
        }
      });

      if (!battle) {
        console.error(`Battle ${roomId} not found`);
        return;
      }

      // Update battle status and start time
      await this.prisma.match.update({
        where: { id: roomId },
        data: {
          status: 'ACTIVE',
          startedAt: new Date()
        }
      });

      // Update Redis battle state
      await this.updateBattleStatus(roomId, 'ACTIVE');
      await this.redis.hSet(`battle:${roomId}`, {
        startTime: Date.now().toString()
      });

      // Start battle timer
      this.startBattleTimer(roomId, battle.timeLimit);

      // Emit battle start to both players
      const battleData = {
        puzzle: {
          id: battle.problem.id,
          title: battle.problem.title,
          description: battle.problem.description,
          difficulty: battle.problem.difficulty,
          timeLimit: battle.timeLimit
        },
        opponent: {
          // Will be populated differently for each player
        },
        timeLimit: battle.timeLimit
      };

      // Send to player1
      battleData.opponent = {
        name: battle.player2.username,
        elo: battle.player2.rank
      };
      this.io.to(roomId).emit('battle:start', battleData);

      console.log(`Battle started in room ${roomId}`);

    } catch (error) {
      console.error('Error starting battle:', error);
    }
  }

  async handleSubmission(socket: Socket, data: { code: string; language: string; roomId: string }): Promise<void> {
    try {
      const { code, language, roomId } = data;
      const userId = (socket as any).userId; // Set by auth middleware

      // Get battle state
      const battleState = await this.getBattleState(roomId);
      if (!battleState || battleState.status !== 'ACTIVE') {
        socket.emit('error', { message: 'Battle is not active' });
        return;
      }

      // Determine which player submitted
      const battle = await this.prisma.match.findUnique({
        where: { id: roomId },
        select: { player1Id: true, player2Id: true }
      });

      if (!battle) {
        socket.emit('error', { message: 'Battle not found' });
        return;
      }

      const isPlayer1 = battle.player1Id === userId;
      const playerField = isPlayer1 ? 'player1' : 'player2';

      // Update submission count
      const submissionField = `${playerField}Submissions`;
      await this.redis.hIncrBy(`battle:${roomId}`, submissionField, 1);

      // Create submission record
      const submission = await this.prisma.submission.create({
        data: {
          matchId: roomId,
          userId,
          problemId: battle.problemId || '', // This should be available
          code,
          language,
          totalTests: 10, // This would come from the problem
          passedTests: 0, // Will be updated after judging
          execTimeMs: 0
        }
      });

      // Send to judge service for evaluation
      // This would typically be done via a queue or direct API call
      await this.sendToJudge(submission.id, code, language);

      // Update opponent about submission progress (without revealing code)
      const progressData = {
        linesChanged: await this.redis.hGet(`battle:${roomId}`, `${playerField}LinesChanged`),
        submissionCount: await this.redis.hGet(`battle:${roomId}`, submissionField)
      };

      // Emit to opponent only
      const opponentId = isPlayer1 ? battle.player2Id : battle.player1Id;
      this.io.to(roomId).except(opponentId).emit('battle:opponent_progress', progressData);

      console.log(`Submission received from user ${userId} in room ${roomId}`);

    } catch (error) {
      console.error('Error handling submission:', error);
      socket.emit('error', { message: 'Failed to process submission' });
    }
  }

  async handleSpellCast(socket: Socket, data: { spellType: SpellType; roomId: string }): Promise<void> {
    try {
      const { spellType, roomId } = data;
      const userId = (socket as any).userId;

      // Get battle state
      const battleState = await this.getBattleState(roomId);
      if (!battleState || battleState.status !== 'ACTIVE') {
        socket.emit('error', { message: 'Battle is not active' });
        return;
      }

      // Check if user has spell available
      const spell = await this.prisma.spell.findUnique({
        where: {
          userId_type: {
            userId,
            type: spellType
          }
        }
      });

      if (!spell || spell.usesRemaining <= 0) {
        socket.emit('error', { message: 'No uses remaining for this spell' });
        return;
      }

      // Get battle details
      const battle = await this.prisma.match.findUnique({
        where: { id: roomId },
        select: { player1Id: true, player2Id: true }
      });

      if (!battle) {
        socket.emit('error', { message: 'Battle not found' });
        return;
      }

      const isPlayer1 = battle.player1Id === userId;
      const targetId = isPlayer1 ? battle.player2Id : battle.player1Id;

      // Apply spell effects
      const effect = await this.applySpellEffect(roomId, spellType, userId, targetId);

      // Create battle spell record
      await this.prisma.battleSpell.create({
        data: {
          matchId: roomId,
          casterId: userId,
          targetId: spellType === 'HEAL' ? null : targetId,
          spellType,
          effect
        }
      });

      // Update spell uses
      await this.prisma.spell.update({
        where: { id: spell.id },
        data: { usesRemaining: spell.usesRemaining - 1 }
      });

      // Emit spell usage to both players
      this.io.to(roomId).emit('battle:spell_used', {
        caster: userId,
        spellType,
        effect
      });

      console.log(`Spell ${spellType} cast by user ${userId} in room ${roomId}`);

    } catch (error) {
      console.error('Error handling spell cast:', error);
      socket.emit('error', { message: 'Failed to cast spell' });
    }
  }

  async handleForfeit(socket: Socket, data: { roomId: string }): Promise<void> {
    try {
      const { roomId } = data;
      const userId = (socket as any).userId;

      // End battle with opponent as winner
      await this.endBattle(roomId, userId, 'forfeit');

    } catch (error) {
      console.error('Error handling forfeit:', error);
      socket.emit('error', { message: 'Failed to forfeit' });
    }
  }

  async handleDisconnection(socket: Socket): Promise<void> {
    const userId = (socket as any).userId;
    
    // Find active battles for this user
    const activeBattles = await this.prisma.match.findMany({
      where: {
        OR: [
          { player1Id: userId, status: { in: ['WAITING', 'COUNTDOWN', 'ACTIVE'] } },
          { player2Id: userId, status: { in: ['WAITING', 'COUNTDOWN', 'ACTIVE'] } }
        ]
      }
    });

    for (const battle of activeBattles) {
      const isPlayer1 = battle.player1Id === userId;
      const playerField = isPlayer1 ? 'player1' : 'player2';
      
      // Mark player as disconnected in Redis
      await this.redis.hSet(`battle:${battle.id}`, {
        [`${playerField}Disconnected`]: 'true'
      });

      // Notify opponent
      const opponentId = isPlayer1 ? battle.player2Id : battle.player1Id;
      this.io.to(battle.id).emit('battle:opponent_disconnected');

      // Start 30-second reconnection timer
      setTimeout(async () => {
        const battleState = await this.getBattleState(battle.id);
        if (battleState && battleState[`${playerField}Disconnected`]) {
          // Player didn't reconnect, end battle
          await this.endBattle(battle.id, userId, 'disconnection');
        }
      }, 30000);

      console.log(`Player ${userId} disconnected from battle ${battle.id}`);
    }
  }

  private async handleReconnection(roomId: string, userId: string, socket: Socket): Promise<void> {
    try {
      const battle = await this.prisma.match.findUnique({
        where: { id: roomId },
        select: { player1Id: true, player2Id: true }
      });

      if (!battle) return;

      const isPlayer1 = battle.player1Id === userId;
      const playerField = isPlayer1 ? 'player1' : 'player2';

      // Mark player as reconnected
      await this.redis.hSet(`battle:${roomId}`, {
        [`${playerField}Disconnected`]: 'false'
      });

      // Notify opponent
      this.io.to(roomId).emit('battle:reconnecting', { playerId: userId });

      // Send current battle state to reconnected player
      const battleState = await this.getBattleState(roomId);
      if (battleState) {
        socket.emit('battle:state_update', battleState);
      }

      console.log(`Player ${userId} reconnected to battle ${roomId}`);

    } catch (error) {
      console.error('Error handling reconnection:', error);
    }
  }

  private async applySpellEffect(roomId: string, spellType: SpellType, casterId: string, targetId: string): Promise<any> {
    const battleKey = `battle:${roomId}`;
    let effect: any = {};

    switch (spellType) {
      case 'HEAL':
        // Heal caster for 20 HP
        const isPlayer1Heal = (await this.prisma.match.findUnique({
          where: { id: roomId },
          select: { player1Id: true }
        }))?.player1Id === casterId;
        
        const hpField = isPlayer1Heal ? 'player1Hp' : 'player2Hp';
        const currentHp = parseInt(await this.redis.hGet(battleKey, hpField) || '0');
        const newHp = Math.min(100, currentHp + 20);
        
        await this.redis.hSet(battleKey, { [hpField]: newHp.toString() });
        effect = { heal: 20, newHp };
        break;

      case 'DAMAGE':
        // Deal 15 damage to target
        const isPlayer1Target = (await this.prisma.match.findUnique({
          where: { id: roomId },
          select: { player1Id: true }
        }))?.player1Id === targetId;
        
        const targetHpField = isPlayer1Target ? 'player1Hp' : 'player2Hp';
        const targetCurrentHp = parseInt(await this.redis.hGet(battleKey, targetHpField) || '0');
        const targetNewHp = Math.max(0, targetCurrentHp - 15);
        
        await this.redis.hSet(battleKey, { [targetHpField]: targetNewHp.toString() });
        effect = { damage: 15, targetNewHp };

        // Create damage record
        await this.prisma.battleDamage.create({
          data: {
            matchId: roomId,
            sourceId: casterId,
            targetId,
            damage: 15,
            damageType: 'spell'
          }
        });

        // Check if target is defeated
        if (targetNewHp <= 0) {
          await this.endBattle(roomId, targetId, 'hp_depleted');
        }
        break;

      case 'TIME_FREEZE':
        // Add 30 seconds to battle timer
        effect = { timeBonus: 30 };
        // Implementation would extend the battle timer
        break;

      case 'SHIELD':
        // Reduce next damage taken by 50%
        effect = { shield: 0.5 };
        // Store shield effect in Redis
        await this.redis.hSet(battleKey, {
          [`${casterId}_shield`]: '0.5'
        });
        break;
    }

    return effect;
  }

  private startBattleTimer(roomId: string, timeLimit: number): void {
    let timeRemaining = timeLimit;
    
    const timer = setInterval(async () => {
      timeRemaining--;

      // Emit time update
      this.io.to(roomId).emit('battle:time_update', { timeRemaining });

      // Warning at 60 seconds
      if (timeRemaining === 60) {
        this.io.to(roomId).emit('battle:time_warning', { secondsLeft: 60 });
      }

      // End battle when time runs out
      if (timeRemaining <= 0) {
        clearInterval(timer);
        this.battleTimers.delete(roomId);
        
        // Determine winner by HP
        const battleState = await this.getBattleState(roomId);
        if (battleState) {
          const winner = battleState.player1Hp > battleState.player2Hp ? 'player1' : 'player2';
          const winnerId = winner === 'player1' ? 
            (await this.prisma.match.findUnique({ where: { id: roomId }, select: { player1Id: true } }))?.player1Id :
            (await this.prisma.match.findUnique({ where: { id: roomId }, select: { player2Id: true } }))?.player2Id;
          
          if (winnerId) {
            await this.endBattle(roomId, winnerId, 'timeout');
          }
        }
      }
    }, 1000);

    this.battleTimers.set(roomId, timer);
  }

  private async endBattle(roomId: string, loserId: string, reason: string): Promise<void> {
    try {
      // Clear timers
      const timer = this.battleTimers.get(roomId);
      if (timer) {
        clearInterval(timer);
        this.battleTimers.delete(roomId);
      }

      const countdownTimer = this.countdownTimers.get(roomId);
      if (countdownTimer) {
        clearInterval(countdownTimer);
        this.countdownTimers.delete(roomId);
      }

      // Get battle details
      const battle = await this.prisma.match.findUnique({
        where: { id: roomId },
        include: {
          player1: { select: { username: true, rank: true } },
          player2: { select: { username: true, rank: true } },
          battleDamage: true,
          submissions: {
            orderBy: { createdAt: 'desc' },
            take: 2
          }
        }
      });

      if (!battle) return;

      // Determine winner
      const winnerId = battle.player1Id === loserId ? battle.player2Id : battle.player1Id;
      const isPlayer1Winner = battle.player1Id === winnerId;

      // Calculate ELO changes
      const eloChange = this.calculateEloChange(
        isPlayer1Winner ? battle.player1.rank : battle.player2.rank,
        isPlayer1Winner ? battle.player2.rank : battle.player1.rank,
        true
      );

      // Update battle in database
      await this.prisma.match.update({
        where: { id: roomId },
        data: {
          status: 'COMPLETED',
          winnerId,
          endedAt: new Date(),
          player1Hp: parseInt(await this.redis.hGet(`battle:${roomId}`, 'player1Hp') || '0'),
          player2Hp: parseInt(await this.redis.hGet(`battle:${roomId}`, 'player2Hp') || '0')
        }
      });

      // Update user stats and ELO
      await this.prisma.user.update({
        where: { id: winnerId },
        data: {
          rank: { increment: eloChange.winner },
          xp: { increment: 100 }
        }
      });

      await this.prisma.user.update({
        where: { id: loserId },
        data: {
          rank: { increment: eloChange.loser }
        }
      });

      // Get damage log
      const damageLog = battle.battleDamage.map(d => ({
        source: d.sourceId,
        target: d.targetId,
        damage: d.damage,
        type: d.damageType,
        timestamp: d.occurredAt
      }));

      // Emit battle end to both players
      const endData = {
        winner: winnerId,
        loser: loserId,
        reason,
        damageLog,
        eloChange,
        rewards: {
          winner: { xp: 100, elo: eloChange.winner },
          loser: { elo: eloChange.loser }
        }
      };

      this.io.to(roomId).emit('battle:end', endData);

      // Clean up Redis data
      await this.redis.del(`battle:${roomId}`);

      console.log(`Battle ${roomId} ended. Winner: ${winnerId}, Reason: ${reason}`);

    } catch (error) {
      console.error('Error ending battle:', error);
    }
  }

  private calculateEloChange(winnerElo: number, loserElo: number, winnerActual: boolean): { winner: number; loser: number } {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const eloChange = Math.round(K * (winnerActual ? 1 : 0) - K * expectedScore);
    
    return {
      winner: Math.abs(eloChange),
      loser: -Math.abs(eloChange)
    };
  }

  private async updateBattleStatus(roomId: string, status: MatchStatus): Promise<void> {
    await this.redis.hSet(`battle:${roomId}`, { status });
  }

  private async getBattleState(roomId: string): Promise<BattleState | null> {
    const data = await this.redis.hGetAll(`battle:${roomId}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      player1Hp: parseInt(data.player1Hp || '0'),
      player2Hp: parseInt(data.player2Hp || '0'),
      player1Submissions: parseInt(data.player1Submissions || '0'),
      player2Submissions: parseInt(data.player2Submissions || '0'),
      player1LinesChanged: parseInt(data.player1LinesChanged || '0'),
      player2LinesChanged: parseInt(data.player2LinesChanged || '0'),
      status: data.status as MatchStatus,
      startTime: parseInt(data.startTime || '0'),
      timeLimit: parseInt(data.timeLimit || '0'),
      player1Disconnected: data.player1Disconnected === 'true',
      player2Disconnected: data.player2Disconnected === 'true'
    };
  }

  private async sendToJudge(submissionId: string, code: string, language: string): Promise<void> {
    // This would typically send to a judge service via queue or API
    // For now, we'll simulate the judging process
    console.log(`Sending submission ${submissionId} to judge service`);
    
    // Simulate async judging
    setTimeout(async () => {
      try {
        // Simulate test results
        const passedTests = Math.floor(Math.random() * 10) + 1;
        const execTimeMs = Math.floor(Math.random() * 1000) + 100;
        
        // Update submission with results
        await this.prisma.submission.update({
          where: { id: submissionId },
          data: {
            passedTests,
            execTimeMs,
            damageDealt: passedTests * 5 // 5 damage per passed test
          }
        });

        console.log(`Submission ${submissionId} judged: ${passedTests}/10 tests passed`);

      } catch (error) {
        console.error('Error updating submission results:', error);
      }
    }, 2000);
  }
}
