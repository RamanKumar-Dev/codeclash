import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
import { PrismaClient } from '@prisma/client';
import { BattleState, SpellState } from '@code-clash/shared-types';
export interface BattleState {
    id: string;
    roomId: string;
    player1Id: string;
    player2Id: string;
    status: 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'JUDGING' | 'COMPLETED' | 'ERROR' | 'ABANDONED';
    puzzle: any;
    puzzleVersion: number;
    player1: {
        id: string;
        username: string;
        elo: number;
        hp: number;
        code: string;
        lastActivity: number;
        spells: SpellState[];
        progress: number;
    };
    player2: {
        id: string;
        username: string;
        elo: number;
        hp: number;
        code: string;
        lastActivity: number;
        spells: SpellState[];
        progress: number;
    };
    startTime?: number;
    endTime?: number;
    lastActivity: number;
    currentRound: number;
    maxRounds: number;
    timeLimit: number;
    countdownStartTime?: number;
    errorReason?: string;
    firstSolve?: string;
}
export declare class EnhancedBattleService {
    private redis;
    private prisma;
    private io;
    private readonly DISCONNECT_TIMEOUT;
    private readonly CODE_PROGRESS_DEBOUNCE;
    private readonly COUNTDOWN_DURATION;
    constructor(redis: RedisClientType, prisma: PrismaClient, io: Server);
    updateBattleState(roomId: string, updates: Partial<BattleState>): Promise<BattleState>;
    private isValidStateTransition;
    getBattleState(roomId: string): Promise<BattleState | null>;
    private isValidBattleState;
    startCountdown(roomId: string): Promise<void>;
    startBattle(roomId: string): Promise<void>;
    handleCodeProgress(socket: Socket, data: {
        code: string;
        progress: number;
    }): Promise<void>;
    handleDisconnect(socket: Socket): Promise<void>;
    handleReconnection(socket: Socket, roomId: string): Promise<void>;
    endBattle(roomId: string, reason: 'VICTORY' | 'TIMEOUT' | 'ABANDONED'): Promise<void>;
    private updateBattleDatabase;
    private cleanupBattleData;
    private broadcastStateChange;
    private calculateTimeRemaining;
    handleJudge0Failure(roomId: string, userId: string, error: string): Promise<void>;
    cleanupExpiredBattles(): Promise<void>;
}
//# sourceMappingURL=enhancedBattleService.d.ts.map