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
export declare class MatchmakingService {
    private redis;
    private prisma;
    private io;
    private matchmakingInterval;
    private queueWaitTime;
    private readonly QUEUE_KEY;
    private readonly INITIAL_ELO_WINDOW;
    private readonly ELO_WINDOW_EXPANSION;
    private readonly EXPANSION_INTERVAL;
    private readonly MATCHMAKING_INTERVAL;
    constructor(redis: Redis.RedisClientType, prisma: PrismaClient, io: SocketIOServer);
    startMatchmaking(): Promise<void>;
    stopMatchmaking(): Promise<void>;
    addToQueue(userId: string, socketId: string, elo: number): Promise<void>;
    removeFromQueue(userId: string): Promise<void>;
    private processMatchmaking;
    private findMatches;
    private createMatch;
    private selectPuzzle;
    private initializeBattleState;
    getQueueSize(): Promise<number>;
    isPlayerInQueue(userId: string): Promise<boolean>;
}
//# sourceMappingURL=matchmakingService.d.ts.map