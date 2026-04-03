import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
import { PrismaClient } from '@prisma/client';
import { PrivateRoom, LiveBattle } from '@code-clash/shared-types';
export interface SocialConfig {
    heartbeatInterval: number;
    roomCodeExpiry: number;
    maxSpectators: number;
    spectatorChatRateLimit: number;
    friendListMaxSize: number;
}
export declare class SocialLayerService {
    private redis;
    private prisma;
    private io;
    private config;
    private readonly DEFAULT_CONFIG;
    constructor(redis: RedisClientType, prisma: PrismaClient, io: Server, config?: Partial<SocialConfig>);
    handleHeartbeat(socket: Socket): Promise<void>;
    handleDisconnect(socket: Socket): Promise<void>;
    private updateFriendsOnlineStatus;
    getOnlineFriends(userId: string): Promise<any[]>;
    createPrivateRoom(createdBy: string, settings: any): Promise<{
        roomCode: string;
        room: PrivateRoom;
    }>;
    joinPrivateRoom(userId: string, roomCode: string): Promise<PrivateRoom | null>;
    leavePrivateRoom(userId: string, roomCode: string): Promise<void>;
    private leaveAllPrivateRooms;
    private generateRoomCode;
    getLiveBattles(page?: number, limit?: number): Promise<LiveBattle[]>;
    joinBattleAsSpectator(userId: string, roomId: string): Promise<boolean>;
    handleSpectatorChat(socket: Socket, data: {
        message: string;
        roomId: string;
    }): Promise<void>;
    private filterProfanity;
    featureBattle(roomId: string, featured: boolean): Promise<void>;
    private getUserSocket;
    startHeartbeatMonitoring(): void;
    cleanupExpiredRooms(): Promise<void>;
}
//# sourceMappingURL=socialLayerService.d.ts.map