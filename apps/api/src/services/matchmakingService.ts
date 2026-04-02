import Redis from 'redis';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

export interface QueuedPlayer {
  userId: string;
  socketId: string;
  elo: number;
  joinedAt: number;
}

export interface MatchResult {
  player1: QueuedPlayer;
  player2: QueuedPlayer;
  puzzle: any;
}

export class MatchmakingService {
  private redis: Redis.RedisClientType;
  private prisma: PrismaClient;
  private io: SocketIOServer;
  private matchmakingInterval: NodeJS.Timeout | null = null;
  private queueWaitTime: Map<string, number> = new Map(); // Track wait times for expanding ELO window
  
  private readonly QUEUE_KEY = 'matchmaking:queue';
  private readonly INITIAL_ELO_WINDOW = 200;
  private readonly ELO_WINDOW_EXPANSION = 50;
  private readonly EXPANSION_INTERVAL = 10000; // 10 seconds
  private readonly MATCHMAKING_INTERVAL = 2000; // 2 seconds

  constructor(redis: Redis.RedisClientType, prisma: PrismaClient, io: SocketIOServer) {
    this.redis = redis;
    this.prisma = prisma;
    this.io = io;
  }

  async startMatchmaking(): Promise<void> {
    if (this.matchmakingInterval) {
      return;
    }

    console.log('Starting matchmaking service...');
    this.matchmakingInterval = setInterval(
      () => this.processMatchmaking(),
      this.MATCHMAKING_INTERVAL
    );
  }

  async stopMatchmaking(): Promise<void> {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
      this.matchmakingInterval = null;
      console.log('Matchmaking service stopped');
    }
  }

  async addToQueue(userId: string, socketId: string, elo: number): Promise<void> {
    const player: QueuedPlayer = {
      userId,
      socketId,
      elo,
      joinedAt: Date.now()
    };

    // Store player data in Redis hash
    await this.redis.hSet(`player:${userId}`, {
      socketId,
      elo: elo.toString(),
      joinedAt: player.joinedAt.toString()
    });

    // Add to sorted set by ELO
    await this.redis.zAdd(this.QUEUE_KEY, {
      score: elo,
      value: userId
    });

    // Set TTL for player data (30 minutes)
    await this.redis.expire(`player:${userId}`, 1800);
    
    // Track wait time for ELO window expansion
    this.queueWaitTime.set(userId, Date.now());

    console.log(`User ${userId} added to matchmaking queue with ELO ${elo}`);
  }

  async removeFromQueue(userId: string): Promise<void> {
    await this.redis.zRem(this.QUEUE_KEY, userId);
    await this.redis.del(`player:${userId}`);
    this.queueWaitTime.delete(userId);
    
    console.log(`User ${userId} removed from matchmaking queue`);
  }

  private async processMatchmaking(): Promise<void> {
    try {
      const queueSize = await this.redis.zCard(this.QUEUE_KEY);
      if (queueSize < 2) {
        return; // Not enough players for matchmaking
      }

      // Get all players in queue with their ELOs
      const queuedPlayers = await this.redis.zRangeWithScores(this.QUEUE_KEY, 0, -1);
      
      // Expand ELO windows based on wait times
      const playerWindows = new Map<string, number>();
      const currentTime = Date.now();
      
      for (const player of queuedPlayers) {
        const waitTime = this.queueWaitTime.get(player.value);
        if (waitTime) {
          const timeInQueue = currentTime - waitTime;
          const expansions = Math.floor(timeInQueue / this.EXPANSION_INTERVAL);
          const windowSize = this.INITIAL_ELO_WINDOW + (expansions * this.ELO_WINDOW_EXPANSION);
          playerWindows.set(player.value, windowSize);
        } else {
          playerWindows.set(player.value, this.INITIAL_ELO_WINDOW);
        }
      }

      // Find matches
      const matches = this.findMatches(queuedPlayers, playerWindows);
      
      // Process found matches
      for (const match of matches) {
        await this.createMatch(match);
      }
    } catch (error) {
      console.error('Error in matchmaking process:', error);
    }
  }

  private findMatches(
    queuedPlayers: Array<{ value: string; score: number }>,
    playerWindows: Map<string, number>
  ): Array<{ player1: string; player2: string }> {
    const matches: Array<{ player1: string; player2: string }> = [];
    const usedPlayers = new Set<string>();

    for (let i = 0; i < queuedPlayers.length; i++) {
      const player1 = queuedPlayers[i];
      
      if (usedPlayers.has(player1.value)) {
        continue;
      }

      const eloWindow1 = playerWindows.get(player1.value) || this.INITIAL_ELO_WINDOW;
      
      // Find best match for player1
      let bestMatch: { value: string; score: number } | null = null;
      let bestDistance = Infinity;

      for (let j = i + 1; j < queuedPlayers.length; j++) {
        const player2 = queuedPlayers[j];
        
        if (usedPlayers.has(player2.value)) {
          continue;
        }

        const eloWindow2 = playerWindows.get(player2.value) || this.INITIAL_ELO_WINDOW;
        const eloDistance = Math.abs(player1.score - player2.score);
        
        // Check if players are within each other's ELO windows
        if (eloDistance <= eloWindow1 && eloDistance <= eloWindow2 && eloDistance < bestDistance) {
          bestMatch = player2;
          bestDistance = eloDistance;
        }
      }

      if (bestMatch) {
        matches.push({
          player1: player1.value,
          player2: bestMatch.value
        });
        usedPlayers.add(player1.value);
        usedPlayers.add(bestMatch.value);
      }
    }

    return matches;
  }

  private async createMatch(match: { player1: string; player2: string }): Promise<void> {
    try {
      // Get player data from Redis
      const player1Data = await this.redis.hGetAll(`player:${match.player1}`);
      const player2Data = await this.redis.hGetAll(`player:${match.player2}`);

      if (!player1Data.socketId || !player2Data.socketId) {
        console.error('Missing player data for match creation');
        return;
      }

      // Select puzzle based on average ELO
      const avgElo = (parseInt(player1Data.elo) + parseInt(player2Data.elo)) / 2;
      const puzzle = await this.selectPuzzle(avgElo);

      if (!puzzle) {
        console.error('No suitable puzzle found for match');
        return;
      }

      // Create match in database
      const dbMatch = await this.prisma.match.create({
        data: {
          player1Id: match.player1,
          player2Id: match.player2,
          problemId: puzzle.id,
          status: 'WAITING',
          timeLimit: puzzle.timeLimitMs / 1000, // Convert to seconds
        },
        include: {
          player1: { select: { username: true, rank: true } },
          player2: { select: { username: true, rank: true } },
          problem: true
        }
      });

      // Remove players from queue
      await this.removeFromQueue(match.player1);
      await this.removeFromQueue(match.player2);

      // Store battle state in Redis
      await this.initializeBattleState(dbMatch.id, match.player1, match.player2);

      // Emit match found to both players
      const matchData = {
        roomId: dbMatch.id,
        opponent: {
          id: match.player2,
          username: dbMatch.player2.username,
          elo: dbMatch.player2.rank
        },
        puzzle: {
          id: puzzle.id,
          title: puzzle.title,
          description: puzzle.description,
          difficulty: puzzle.difficulty,
          timeLimit: puzzle.timeLimitMs / 1000,
          testCases: puzzle.testCases
        }
      };

      this.io.to(player1Data.socketId).emit('match:found', matchData);
      
      // Swap opponent data for player2
      matchData.opponent = {
        id: match.player1,
        username: dbMatch.player1.username,
        elo: dbMatch.player1.rank
      };
      this.io.to(player2Data.socketId).emit('match:found', matchData);

      console.log(`Match created: ${match.player1} vs ${match.player2} in room ${dbMatch.id}`);

    } catch (error) {
      console.error('Error creating match:', error);
    }
  }

  private async selectPuzzle(avgElo: number): Promise<any> {
    try {
      // Determine difficulty based on average ELO
      let difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      if (avgElo < 1100) {
        difficulty = 'EASY';
      } else if (avgElo < 1400) {
        difficulty = 'MEDIUM';
      } else {
        difficulty = 'HARD';
      }

      // Get random puzzle of appropriate difficulty
      const puzzles = await this.prisma.problem.findMany({
        where: { difficulty },
      });

      if (puzzles.length === 0) {
        return null;
      }

      const randomIndex = Math.floor(Math.random() * puzzles.length);
      return puzzles[randomIndex];

    } catch (error) {
      console.error('Error selecting puzzle:', error);
      return null;
    }
  }

  private async initializeBattleState(roomId: string, player1Id: string, player2Id: string): Promise<void> {
    const battleKey = `battle:${roomId}`;
    
    // Initialize battle state in Redis hash
    await this.redis.hSet(battleKey, {
      player1Hp: '100',
      player2Hp: '100',
      player1Submissions: '0',
      player2Submissions: '0',
      player1LinesChanged: '0',
      player2LinesChanged: '0',
      status: 'WAITING',
      startTime: Date.now().toString(),
      timeLimit: '300' // 5 minutes default
    });

    // Set TTL for battle state (30 minutes)
    await this.redis.expire(battleKey, 1800);

    console.log(`Battle state initialized for room ${roomId}`);
  }

  async getQueueSize(): Promise<number> {
    return await this.redis.zCard(this.QUEUE_KEY);
  }

  async isPlayerInQueue(userId: string): Promise<boolean> {
    const rank = await this.redis.zRank(this.QUEUE_KEY, userId);
    return rank !== null;
  }
}
