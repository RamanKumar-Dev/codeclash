import { Server } from 'socket.io';
export declare class SocketIORedisAdapter {
    private io;
    private redisClient;
    private pubClient;
    private subClient;
    constructor(io: Server, redisUrl: string);
    initialize(): Promise<void>;
    disconnect(): Promise<void>;
    broadcastToAll(event: string, data: any): Promise<void>;
    broadcastToRoom(room: string, event: string, data: any): Promise<void>;
    getConnectedClientsCount(): Promise<number>;
    getAllRooms(): Promise<string[]>;
    getClientsInRoom(room: string): Promise<string[]>;
    healthCheck(): Promise<{
        status: string;
        details: any;
    }>;
}
export declare function setupSocketIORedisAdapter(io: Server, redisUrl: string): Promise<SocketIORedisAdapter>;
//# sourceMappingURL=socketRedisAdapter.d.ts.map