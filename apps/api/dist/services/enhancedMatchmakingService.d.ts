import { RedisClientType } from 'redis';
import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
export interface MatchmakingOptions {
    initialEloWindow: number;
    maxEloWindow: number;
    windowExpansionInterval: number;
    windowExpansionAmount: number;
    maxWaitTime: number;
    battleTimeout: number;
}
export declare class EnhancedMatchmakingService {
    private redis;
    private prisma;
    private io;
    private options;
    private readonly DEFAULT_OPTIONS;
    constructor(redis: RedisClientType, prisma: PrismaClient, io: Server, options?: Partial<MatchmakingOptions>);
    addToQueue(userId: string, socketId: string, elo: number): Promise<void>;
    removeFromQueue(userId: string): Promise<void>;
    findMatch(): Promise<{
        player1: string;
        player2: string;
    } | null>;
    private expandEloWindows;
    startMatchmaking(): Promise<void>;
    private createBattle;
    private selectPuzzle;
    private getMatchDifficulty;
    private getRecentPuzzles;
    private notifyQueueSize;
    private notifyPlayerMatch;
    private notifyTimeout;
    private notifyError;
    getQueueSize(): Promise<number>;
    cleanupExpired(): Promise<void>;
}
//# sourceMappingURL=enhancedMatchmakingService.d.ts.map