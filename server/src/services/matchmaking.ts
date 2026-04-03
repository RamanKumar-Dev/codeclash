import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
import { nanoid } from 'nanoid';
import { UserService } from './userService';
import { ProblemService } from './problemService';

interface QueueEntry {
  userId: string;
  elo: number;
  joinedAt: number;
  eloWindow: number;
}

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
}

const INITIAL_HP = 500;
const INITIAL_ELO_WINDOW = 150;
const ELO_EXPAND_RATE = 75;      // ELO window expands by this every 10s
const MAX_ELO_WINDOW = 600;
const TICK_INTERVAL_MS = 2000;   // Matchmaking tick every 2s

export class MatchmakingService {
  private io: Server;
  private redis: RedisClientType;
  private socketRegistry: Map<string, Socket>;
  private queue: Map<string, QueueEntry> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;

  constructor(io: Server, redis: RedisClientType, socketRegistry: Map<string, Socket>) {
    this.io = io;
    this.redis = redis;
    this.socketRegistry = socketRegistry;
    this.startMatchmakingLoop();
  }

  /** Add player to queue */
  async addToQueue(userId: string, elo: number = 1000): Promise<void> {
    if (this.queue.has(userId)) return;

    const entry: QueueEntry = {
      userId,
      elo,
      joinedAt: Date.now(),
      eloWindow: INITIAL_ELO_WINDOW,
    };

    this.queue.set(userId, entry);

    // Also store in Redis for crash resilience (TTL 5 min)
    await this.redis.setEx(
      `queue:player:${userId}`,
      300,
      JSON.stringify(entry)
    );

    console.log(`[Queue] ${userId} joined (ELO: ${elo}). Queue size: ${this.queue.size}`);
  }

  /** Remove player from queue */
  async removeFromQueue(userId: string): Promise<void> {
    if (this.queue.delete(userId)) {
      await this.redis.del(`queue:player:${userId}`);
      console.log(`[Queue] ${userId} left. Queue size: ${this.queue.size}`);
    }
  }

  /** Matchmaking loop — runs every 2s */
  private startMatchmakingLoop(): void {
    this.tickInterval = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const players = Array.from(this.queue.values());

    // Expand ELO windows over time
    for (const p of players) {
      const ageSeconds = (now - p.joinedAt) / 1000;
      p.eloWindow = Math.min(
        INITIAL_ELO_WINDOW + Math.floor(ageSeconds / 10) * ELO_EXPAND_RATE,
        MAX_ELO_WINDOW
      );
    }

    // Sort by join time (FIFO within ELO window)
    players.sort((a, b) => a.joinedAt - b.joinedAt);

    // Send queue position updates
    players.forEach((p, idx) => {
      const socket = this.socketRegistry.get(p.userId);
      if (socket) {
        const waitMs = now - p.joinedAt;
        socket.emit('queue:position', {
          position: idx + 1,
          total: players.length,
          waitSeconds: Math.floor(waitMs / 1000),
          estimatedWaitSeconds: Math.max(0, (players.length - idx) * 3),
        });
      }
    });

    // Try to match players
    const matched = new Set<string>();
    for (let i = 0; i < players.length; i++) {
      if (matched.has(players[i].userId)) continue;
      for (let j = i + 1; j < players.length; j++) {
        if (matched.has(players[j].userId)) continue;
        const eloDiff = Math.abs(players[i].elo - players[j].elo);
        const window = Math.min(players[i].eloWindow, players[j].eloWindow);
        if (eloDiff <= window) {
          matched.add(players[i].userId);
          matched.add(players[j].userId);
          await this.createMatch(players[i], players[j]);
          break;
        }
      }
    }
  }

  private async createMatch(p1: QueueEntry, p2: QueueEntry): Promise<void> {
    // Remove from queue first
    this.queue.delete(p1.userId);
    this.queue.delete(p2.userId);
    await this.redis.del(`queue:player:${p1.userId}`);
    await this.redis.del(`queue:player:${p2.userId}`);

    const roomId = `battle_${nanoid(10)}`;

    // Pick a problem suited to average ELO
    const avgElo = (p1.elo + p2.elo) / 2;
    const problem = await this.selectProblemForElo(avgElo);
    if (!problem) {
      console.error('[Match] No problems found — cannot create match');
      return;
    }

    // Get player usernames
    const [user1, user2] = await Promise.all([
      UserService.getUserById(p1.userId),
      UserService.getUserById(p2.userId),
    ]);
    const player1Name = user1?.username || `Player_${p1.userId.slice(0, 4)}`;
    const player2Name = user2?.username || `Player_${p2.userId.slice(0, 4)}`;

    // Create match record in DB
    let matchId: string | undefined;
    try {
      const match = await this.createMatchRecord(p1.userId, p2.userId, problem.id);
      matchId = match.id;
    } catch (e) {
      console.error('[Match] Failed to create DB record:', e);
    }

    // Initialize battle state in Redis
    const battleState: BattleState = {
      player1Id: p1.userId,
      player2Id: p2.userId,
      problemId: problem.id,
      hp1: INITIAL_HP,
      hp2: INITIAL_HP,
      startTimestamp: Date.now(),
      status: 'WAITING',
      sub1Count: 0,
      sub2Count: 0,
      matchId,
    };

    await this.redis.setEx(
      `battle:${roomId}`,
      7200, // 2 hour TTL
      JSON.stringify(battleState)
    );

    // Notify both players
    const socket1 = this.socketRegistry.get(p1.userId);
    const socket2 = this.socketRegistry.get(p2.userId);

    const matchPayload1 = {
      roomId,
      opponentName: player2Name,
      opponentElo: p2.elo,
      puzzle: this.formatPuzzle(problem),
      timeLimitSeconds: Math.floor(problem.timeLimitMs / 1000),
      myHp: INITIAL_HP,
      opponentHp: INITIAL_HP,
    };

    const matchPayload2 = {
      roomId,
      opponentName: player1Name,
      opponentElo: p1.elo,
      puzzle: this.formatPuzzle(problem),
      timeLimitSeconds: Math.floor(problem.timeLimitMs / 1000),
      myHp: INITIAL_HP,
      opponentHp: INITIAL_HP,
    };

    if (socket1) {
      socket1.join(roomId);
      socket1.emit('match:found', matchPayload1);
    }
    if (socket2) {
      socket2.join(roomId);
      socket2.emit('match:found', matchPayload2);
    }

    console.log(`[Match] ${player1Name} (${p1.elo}) vs ${player2Name} (${p2.elo}) → room ${roomId}`);

    // Auto-start countdown after 1s (both players get the match:found event)
    setTimeout(async () => {
      battleState.status = 'COUNTDOWN';
      await this.redis.setEx(`battle:${roomId}`, 7200, JSON.stringify(battleState));

      for (let i = 3; i >= 1; i--) {
        setTimeout(() => {
          this.io.to(roomId).emit('battle:countdown', { secondsLeft: i });
        }, (3 - i) * 1000);
      }

      setTimeout(async () => {
        await this.startBattle(roomId, battleState, problem);
      }, 3000);
    }, 1000);
  }

  private async startBattle(roomId: string, state: BattleState, problem: any): Promise<void> {
    state.status = 'ACTIVE';
    state.startTimestamp = Date.now();
    await this.redis.setEx(`battle:${roomId}`, 7200, JSON.stringify(state));

    this.io.to(roomId).emit('battle:start', {
      puzzle: this.formatPuzzle(problem),
      timeLimitSeconds: Math.floor(problem.timeLimitMs / 1000),
    });

    const timeLimitSec = Math.floor(problem.timeLimitMs / 1000);

    // Start server-owned timer with periodic resync
    this.startBattleTimer(roomId, timeLimitSec, problem.timeLimitMs);
  }

  /** Server-owned battle timer with periodic resync */
  private startBattleTimer(roomId: string, timeLimitSec: number, timeLimitMs: number): void {
    let elapsedSeconds = 0;
    const tickInterval = 10000; // 10 seconds
    
    const timerInterval = setInterval(async () => {
      elapsedSeconds += tickInterval / 1000;
      
      try {
        const battleState = await this.getBattleState(roomId);
        if (!battleState || battleState.status !== 'ACTIVE') {
          clearInterval(timerInterval);
          return;
        }
        
        const remainingSeconds = Math.max(0, timeLimitSec - elapsedSeconds);
        
        // Emit timer tick to all clients for resync
        this.io.to(roomId).emit('battle:tick', {
          elapsedSeconds,
          remainingSeconds,
          totalSeconds: timeLimitSec,
          timestamp: Date.now()
        });
        
        // 60s warning
        if (remainingSeconds === 60) {
          this.io.to(roomId).emit('battle:time_warning', { secondsLeft: 60 });
        }
        
        // Battle timeout
        if (remainingSeconds <= 0) {
          clearInterval(timerInterval);
          
          battleState.status = 'ENDED';
          await this.redis.setEx(`battle:${roomId}`, 7200, JSON.stringify(battleState));

          const winnerId = battleState.hp1 >= battleState.hp2
            ? battleState.player1Id
            : battleState.player2Id;

          this.io.to(roomId).emit('battle:timeout', {
            winnerId,
            hp1: battleState.hp1,
            hp2: battleState.hp2,
          });
        }
      } catch (error) {
        console.error('[Timer] Error in battle timer:', error);
        clearInterval(timerInterval);
      }
    }, tickInterval);
    
    // Store timer reference for cleanup
    this.redis.setEx(`timer:${roomId}`, timeLimitSec + 60, JSON.stringify({
      intervalId: timerInterval.toString(),
      startTime: Date.now(),
      timeLimitSec
    }));
  }

  /** Select problem based on average ELO */
  private async selectProblemForElo(avgElo: number): Promise<any | null> {
    let difficulty = 'easy';
    if (avgElo >= 1400) difficulty = 'hard';
    else if (avgElo >= 1200) difficulty = 'medium';

    try {
      const problems = await ProblemService.getProblemsByDifficulty(difficulty);
      if (problems.length === 0) {
        return ProblemService.getRandomProblem();
      }
      return problems[Math.floor(Math.random() * problems.length)];
    } catch {
      return ProblemService.getRandomProblem();
    }
  }

  private formatPuzzle(problem: any) {
    return {
      id: problem.id,
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      examples: problem.examples || [],
      testCases: (problem.testCases || []).filter((tc: any) => !tc.isHidden),
      timeLimitSeconds: Math.floor(problem.timeLimitMs / 1000),
      p50RuntimeMs: problem.p50RuntimeMs || 1000,
      tags: problem.tags || [],
    };
  }

  private async createMatchRecord(p1Id: string, p2Id: string, problemId: string) {
    const { prisma } = await import('../lib/prisma');
    return prisma.match.create({
      data: { player1Id: p1Id, player2Id: p2Id, problemId, status: 'waiting' },
    });
  }

  private async getBattleState(roomId: string): Promise<BattleState | null> {
    const raw = await this.redis.get(`battle:${roomId}`);
    return raw ? JSON.parse(raw) : null;
  }
}
