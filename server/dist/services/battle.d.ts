import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
interface BattleSubmitEvent {
    matchId: string;
    userId: string;
    code: string;
    language: string;
    languageId?: number;
    roomId?: string;
}
interface BattleForfeitEvent {
    matchId: string;
    userId: string;
    roomId?: string;
}
export declare class BattleService {
    private io;
    private redis;
    private judge0Url;
    constructor(io: Server, redis: RedisClientType);
    handleSubmit(socket: Socket, data: BattleSubmitEvent): Promise<void>;
    private executeCode;
    private getJudge0Result;
    private calculateDamage;
    handleForfeit(socket: Socket, data: BattleForfeitEvent): Promise<void>;
    startCountdown(roomId: string): Promise<void>;
    startBattle(roomId: string): Promise<void>;
    private endBattleOnTime;
    private endBattle;
    private getBattleState;
    private getPuzzleData;
    private isPlayerInBattle;
    private getUserName;
}
export {};
//# sourceMappingURL=battle.d.ts.map