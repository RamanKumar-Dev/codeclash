"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketIORedisAdapter = void 0;
exports.setupSocketIORedisAdapter = setupSocketIORedisAdapter;
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("redis");
class SocketIORedisAdapter {
    constructor(io, redisUrl) {
        this.io = io;
        // Create Redis clients for adapter
        this.redisClient = (0, redis_1.createClient)({ url: redisUrl });
        this.pubClient = (0, redis_1.createClient)({ url: redisUrl });
        this.subClient = (0, redis_1.createClient)({ url: redisUrl });
    }
    async initialize() {
        try {
            // Connect Redis clients
            await Promise.all([
                this.redisClient.connect(),
                this.pubClient.connect(),
                this.subClient.connect(),
            ]);
            console.log('Redis clients connected for Socket.io adapter');
            // Create and set Redis adapter
            const adapter = (0, redis_adapter_1.createAdapter)(this.pubClient, this.subClient);
            this.io.adapter(adapter);
            console.log('Socket.io Redis adapter initialized');
        }
        catch (error) {
            console.error('Failed to initialize Socket.io Redis adapter:', error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await Promise.all([
                this.redisClient.quit(),
                this.pubClient.quit(),
                this.subClient.quit(),
            ]);
            console.log('Redis clients disconnected');
        }
        catch (error) {
            console.error('Error disconnecting Redis clients:', error);
        }
    }
    // Helper methods for distributed Socket.io operations
    // Broadcast to all servers
    async broadcastToAll(event, data) {
        this.io.emit(event, data);
    }
    // Broadcast to specific room across all servers
    async broadcastToRoom(room, event, data) {
        this.io.to(room).emit(event, data);
    }
    // Get number of connected clients across all servers
    async getConnectedClientsCount() {
        const sockets = await this.io.fetchSockets();
        return sockets.length;
    }
    // Get rooms across all servers
    async getAllRooms() {
        const sockets = await this.io.fetchSockets();
        const rooms = new Set();
        sockets.forEach(socket => {
            socket.rooms.forEach(room => {
                if (room !== socket.id) {
                    rooms.add(room);
                }
            });
        });
        return Array.from(rooms);
    }
    // Get clients in specific room across all servers
    async getClientsInRoom(room) {
        const sockets = await this.io.in(room).fetchSockets();
        return sockets.map(socket => socket.id);
    }
    // Health check for Redis adapter
    async healthCheck() {
        try {
            // Check Redis connections
            const redisPing = await this.redisClient.ping();
            const pubPing = await this.pubClient.ping();
            const subPing = await this.subClient.ping();
            const details = {
                redis: redisPing === 'PONG' ? 'connected' : 'disconnected',
                pubClient: pubPing === 'PONG' ? 'connected' : 'disconnected',
                subClient: subPing === 'PONG' ? 'connected' : 'disconnected',
                connectedClients: await this.getConnectedClientsCount(),
                activeRooms: (await this.getAllRooms()).length,
            };
            const status = Object.values(details).every(status => typeof status === 'string' ? status === 'connected' : true) ? 'healthy' : 'degraded';
            return { status, details };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: { error: error instanceof Error ? error.message : 'Unknown error' },
            };
        }
    }
}
exports.SocketIORedisAdapter = SocketIORedisAdapter;
// Factory function for easy setup
async function setupSocketIORedisAdapter(io, redisUrl) {
    const adapter = new SocketIORedisAdapter(io, redisUrl);
    await adapter.initialize();
    return adapter;
}
//# sourceMappingURL=socketRedisAdapter.js.map