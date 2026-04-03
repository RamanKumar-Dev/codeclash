import { Server } from 'socket.io';
import { RedisClientType } from 'redis';
export declare class MatchmakingService {
    private io;
    private redis;
    private queue;
    constructor(io: Server, redis: RedisClientType);
    addToQueue(userId: string): Promise<void>;
    removeFromQueue(userId: string): Promise<void>;
    private tryMatchmaking;
    private createMatch;
    private getSeededPuzzles;
    private getUserName;
    private getUserSocket;
}
//# sourceMappingURL=matchmaking.d.ts.map