import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { Server } from 'socket.io';

export class SocketIORedisAdapter {
  private io: Server;
  private redisClient: RedisClientType;
  private pubClient: RedisClientType;
  private subClient: RedisClientType;

  constructor(io: Server, redisUrl: string) {
    this.io = io;
    
    // Create Redis clients for adapter
    this.redisClient = createClient({ url: redisUrl });
    this.pubClient = createClient({ url: redisUrl });
    this.subClient = createClient({ url: redisUrl });
  }

  async initialize(): Promise<void> {
    try {
      // Connect Redis clients
      await Promise.all([
        this.redisClient.connect(),
        this.pubClient.connect(),
        this.subClient.connect(),
      ]);

      console.log('Redis clients connected for Socket.io adapter');

      // Create and set Redis adapter
      const adapter = createAdapter(this.pubClient, this.subClient);
      this.io.adapter(adapter);

      console.log('Socket.io Redis adapter initialized');
    } catch (error) {
      console.error('Failed to initialize Socket.io Redis adapter:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.redisClient.quit(),
        this.pubClient.quit(),
        this.subClient.quit(),
      ]);
      console.log('Redis clients disconnected');
    } catch (error) {
      console.error('Error disconnecting Redis clients:', error);
    }
  }

  // Helper methods for distributed Socket.io operations
  
  // Broadcast to all servers
  async broadcastToAll(event: string, data: any): Promise<void> {
    this.io.emit(event, data);
  }

  // Broadcast to specific room across all servers
  async broadcastToRoom(room: string, event: string, data: any): Promise<void> {
    this.io.to(room).emit(event, data);
  }

  // Get number of connected clients across all servers
  async getConnectedClientsCount(): Promise<number> {
    const sockets = await this.io.fetchSockets();
    return sockets.length;
  }

  // Get rooms across all servers
  async getAllRooms(): Promise<string[]> {
    const sockets = await this.io.fetchSockets();
    const rooms = new Set<string>();
    
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
  async getClientsInRoom(room: string): Promise<string[]> {
    const sockets = await this.io.in(room).fetchSockets();
    return sockets.map(socket => socket.id);
  }

  // Health check for Redis adapter
  async healthCheck(): Promise<{ status: string; details: any }> {
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

      const status = Object.values(details).every(status => 
        typeof status === 'string' ? status === 'connected' : true
      ) ? 'healthy' : 'degraded';

      return { status, details };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}

// Factory function for easy setup
export async function setupSocketIORedisAdapter(io: Server, redisUrl: string): Promise<SocketIORedisAdapter> {
  const adapter = new SocketIORedisAdapter(io, redisUrl);
  await adapter.initialize();
  return adapter;
}
