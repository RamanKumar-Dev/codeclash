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
export declare class BattleService {
    private redis;
    private prisma;
    private io;
    private battleTimers;
    private countdownTimers;
    constructor(redis: Redis.RedisClientType, prisma: PrismaClient, io: SocketIOServer);
    handleBattleConnection(socket: Socket, userId: string): Promise<void>;
    startBattleCountdown(roomId: string): Promise<void>;
    startBattle(roomId: string): Promise<void>;
    handleSubmission(socket: Socket, data: {
        code: string;
        language: string;
        roomId: string;
    }): Promise<void>;
    handleSpellCast(socket: Socket, data: {
        spellType: SpellType;
        roomId: string;
    }): Promise<void>;
    handleForfeit(socket: Socket, data: {
        roomId: string;
    }): Promise<void>;
    handleDisconnection(socket: Socket): Promise<void>;
    private handleReconnection;
    private applySpellEffect;
    private startBattleTimer;
    private endBattle;
    private calculateEloChange;
    private updateBattleStatus;
    private getBattleState;
    private sendToJudge;
}
//# sourceMappingURL=battleService.d.ts.map