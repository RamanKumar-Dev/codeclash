import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@code-clash/shared-types';
import { redisService } from '../services/redis.service';
import { userService } from '../services/user.service';
import { MatchmakingHandlers } from './matchmaking.handlers';
import { BattleHandlers } from './battle.handlers';

export class ConnectionManager {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private matchmakingHandlers: MatchmakingHandlers;
  private battleHandlers: BattleHandlers;
  private connectedUsers = new Map<string, Socket>(); // userId -> socket
  private socketToUser = new Map<string, string>(); // socketId -> userId

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
    this.matchmakingHandlers = new MatchmakingHandlers(io);
    this.battleHandlers = new BattleHandlers(io);
  }

  // Handle new connection
  async handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
    console.log(`New connection: ${socket.id}`);

    // Setup authentication middleware
    socket.on('authenticate', async (data: { token: string; userId: string }) => {
      try {
        // Verify JWT token and user
        const user = await userService.verifyToken(data.token);
        if (!user || user.id !== data.userId) {
          socket.emit('auth_result', { success: false, error: 'Invalid authentication' });
          socket.disconnect();
          return;
        }

        // Store user data on socket
        socket.data.userId = user.id;
        socket.data.username = user.username;
        socket.data.elo = user.elo || 1200;

        // Track connection
        this.connectedUsers.set(user.id, socket);
        this.socketToUser.set(socket.id, user.id);

        // Store user session in Redis
        await redisService.client.setex(
          `user:session:${user.id}`,
          3600, // 1 hour
          JSON.stringify({
            socketId: socket.id,
            connectedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
          })
        );

        // Join user to their personal room for direct messages
        socket.join(`user:${user.id}`);

        // Register handlers
        this.registerHandlers(socket);

        // Send auth success
        socket.emit('auth_result', { 
          success: true, 
          user: {
            id: user.id,
            username: user.username,
            elo: user.elo || 1200,
          }
        });

        // Update user status to online
        await this.updateUserStatus(user.id, 'online');

        console.log(`User ${user.id} authenticated successfully`);
      } catch (error) {
        console.error('Authentication error:', error);
        socket.emit('auth_result', { success: false, error: 'Authentication failed' });
        socket.disconnect();
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      await this.handleDisconnection(socket);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  }

  // Handle disconnection
  private async handleDisconnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
    const userId = socket.data.userId;
    const socketId = socket.id;

    if (!userId) {
      console.log(`Unauthenticated socket disconnected: ${socketId}`);
      return;
    }

    try {
      console.log(`User ${userId} disconnected: ${socketId}`);

      // Remove from tracking
      this.connectedUsers.delete(userId);
      this.socketToUser.delete(socketId);

      // Check if user has other connections (multi-tab support)
      const remainingConnections = Array.from(this.io.sockets.sockets.values())
        .filter(s => s.data.userId === userId && s.id !== socketId);

      if (remainingConnections.length === 0) {
        // User is completely disconnected
        await this.updateUserStatus(userId, 'offline');
        
        // Remove from Redis session
        await redisService.client.del(`user:session:${userId}`);

        // Handle battle disconnection through battle handlers
        await this.battleHandlers.handleDisconnection(socket);
        
        // Handle queue removal through matchmaking handlers
        await this.matchmakingHandlers.handleDisconnection(socket);
      } else {
        // User still has other connections, update session with new socket
        const newSocket = remainingConnections[0];
        await redisService.client.setex(
          `user:session:${userId}`,
          3600,
          JSON.stringify({
            socketId: newSocket.id,
            connectedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
          })
        );
      }
    } catch (error) {
      console.error('Error handling disconnection:', error);
    }
  }

  // Handle reconnection
  async handleReconnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>, userId: string): Promise<void> {
    try {
      // Check if user was in a battle
      const battleRoom = await redisService.getUserBattleRoom(userId);
      if (battleRoom) {
        // Handle battle reconnection
        await this.battleHandlers.handleBattleReconnect(socket, { roomId: battleRoom });
        
        // Update user status
        await this.updateUserStatus(userId, 'in_battle');
      } else {
        // Check if user was in queue
        const queueEntries = await redisService.getQueueEntries();
        const inQueue = queueEntries.find(entry => entry.userId === userId);
        
        if (inQueue) {
          await this.updateUserStatus(userId, 'in_queue');
        } else {
          await this.updateUserStatus(userId, 'online');
        }
      }

      console.log(`User ${userId} reconnected successfully`);
    } catch (error) {
      console.error('Error handling reconnection:', error);
    }
  }

  // Register all handlers for a socket
  private registerHandlers(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    // Only register handlers after authentication
    if (!socket.data.userId) {
      socket.on('authenticate', (data) => this.handleConnection(socket));
      return;
    }

    // Register matchmaking and battle handlers
    this.matchmakingHandlers.registerHandlers(socket);
    this.battleHandlers.registerHandlers(socket);

    // Additional connection-specific handlers
    socket.on('reconnect_battle', async (data: { roomId: string }) => {
      await this.handleReconnection(socket, socket.data.userId);
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('get_status', async () => {
      const userId = socket.data.userId;
      const battleRoom = await redisService.getUserBattleRoom(userId);
      const queueEntries = await redisService.getQueueEntries();
      const inQueue = queueEntries.find(entry => entry.userId === userId);

      let status = 'online';
      if (battleRoom) status = 'in_battle';
      else if (inQueue) status = 'in_queue';

      socket.emit('status_update', { status, battleRoom, inQueue: !!inQueue });
    });
  }

  // Update user status
  private async updateUserStatus(userId: string, status: 'online' | 'offline' | 'in_battle' | 'in_queue'): Promise<void> {
    try {
      // Update in Redis
      await redisService.client.hset(`user:status:${userId}`, {
        status,
        lastUpdated: new Date().toISOString(),
      });

      // Broadcast status change to friends/followers (if applicable)
      this.io.emit('user_status', {
        userId,
        status,
        timestamp: new Date().toISOString(),
      });

      // Update user in database
      await userService.updateUserStatus(userId, status);
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  }

  // Get user by socket ID
  getUserBySocket(socketId: string): string | null {
    return this.socketToUser.get(socketId) || null;
  }

  // Get socket by user ID
  getSocketByUser(userId: string): Socket<ClientToServerEvents, ServerToClientEvents> | null {
    return this.connectedUsers.get(userId) || null;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get all connected users
  getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Send message to specific user
  sendToUser(userId: string, event: string, data: any): boolean {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }

  // Broadcast to all users
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // Get connection statistics
  getConnectionStats(): {
    totalConnections: number;
    uniqueUsers: number;
    usersInBattle: number;
    usersInQueue: number;
  } {
    return {
      totalConnections: this.io.sockets.sockets.size,
      uniqueUsers: this.connectedUsers.size,
      usersInBattle: 0, // Would need to query Redis for accurate count
      usersInQueue: 0,   // Would need to query Redis for accurate count
    };
  }

  // Cleanup inactive connections
  async cleanupInactiveConnections(): Promise<void> {
    try {
      const now = Date.now();
      const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [userId, socket] of this.connectedUsers.entries()) {
        const sessionData = await redisService.client.get(`user:session:${userId}`);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const lastActivity = new Date(session.lastActivity).getTime();
          
          if (now - lastActivity > inactiveThreshold) {
            console.log(`Cleaning up inactive connection for user ${userId}`);
            socket.disconnect();
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up inactive connections:', error);
    }
  }

  // Setup periodic cleanup
  setupPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 60000); // Every minute
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('Shutting down connection manager...');

    // Disconnect all clients
    for (const socket of this.connectedUsers.values()) {
      socket.emit('server_shutdown', { message: 'Server is shutting down' });
      socket.disconnect();
    }

    // Clear tracking
    this.connectedUsers.clear();
    this.socketToUser.clear();

    console.log('Connection manager shutdown complete');
  }
}
