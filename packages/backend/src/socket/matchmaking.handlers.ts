import { Server, Socket } from 'socket.io';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  MatchmakingRequest,
  MatchmakingResponse 
} from '@code-clash/shared-types';
import { matchmakingService } from '../services/matchmaking.service';
import { userService } from '../services/user.service';

export class MatchmakingHandlers {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  // Handle queue join
  async handleQueueJoin(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: MatchmakingRequest): Promise<void> {
    try {
      // Validate user
      const user = await userService.getUserById(data.userId);
      if (!user) {
        socket.emit('error', 'User not found');
        return;
      }

      // Check if socket is authenticated for this user
      if (socket.data.userId !== data.userId) {
        socket.emit('error', 'Authentication mismatch');
        return;
      }

      // Join queue
      const response = await matchmakingService.joinQueue(data);
      
      if (response.success) {
        // Join socket to queue room for notifications
        socket.join(`queue:${data.userId}`);
        
        // Subscribe to match found events
        this.subscribeToMatchFound(socket, data.userId);
        
        socket.emit('queue:joined', {
          queueSize: response.queueSize!,
          estimatedWaitTime: response.estimatedWaitTime!,
        });

        console.log(`User ${data.userId} joined matchmaking queue`);
      } else {
        socket.emit('error', response.error || 'Failed to join queue');
      }
    } catch (error) {
      console.error('Error handling queue join:', error);
      socket.emit('error', 'Internal server error');
    }
  }

  // Handle queue leave
  async handleQueueLeave(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      // Leave queue
      await matchmakingService.leaveQueue(userId);
      
      // Leave socket room
      socket.leave(`queue:${userId}`);
      
      socket.emit('queue:left');
      
      console.log(`User ${userId} left matchmaking queue`);
    } catch (error) {
      console.error('Error handling queue leave:', error);
      socket.emit('error', 'Internal server error');
    }
  }

  // Handle queue status request
  async handleQueueStatus(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      const response = await matchmakingService.getQueueStatus(userId);
      
      if (response.success) {
        socket.emit('queue:status', {
          queueSize: response.queueSize!,
          estimatedWaitTime: response.estimatedWaitTime!,
        });
      } else {
        socket.emit('error', response.error || 'Failed to get queue status');
      }
    } catch (error) {
      console.error('Error handling queue status:', error);
      socket.emit('error', 'Internal server error');
    }
  }

  // Subscribe to match found events for a user
  private subscribeToMatchFound(socket: Socket<ClientToServerEvents, ServerToClientEvents>, userId: string): void {
    const channel = `match_found:${userId}`;
    
    // Use Redis pub/sub or internal event system
    matchmakingService.on('matchFound', (data: any) => {
      if (data.userId === userId) {
        socket.emit('match:found', data);
        
        // Leave queue room
        socket.leave(`queue:${userId}`);
        
        // Join battle room
        socket.join(`battle:${data.roomId}`);
        
        console.log(`Match found for user ${userId}, joined battle room ${data.roomId}`);
      }
    });
  }

  // Handle disconnection
  async handleDisconnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) return;

      // Remove from queue if user was in queue
      await matchmakingService.leaveQueue(userId);
      
      console.log(`User ${userId} disconnected, removed from queue`);
    } catch (error) {
      console.error('Error handling disconnection:', error);
    }
  }

  // Register all matchmaking handlers
  registerHandlers(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    socket.on('queue:join', (data) => this.handleQueueJoin(socket, data));
    socket.on('queue:leave', () => this.handleQueueLeave(socket));
    socket.on('queue:status', () => this.handleQueueStatus(socket));
    socket.on('disconnect', () => this.handleDisconnection(socket));

    // Legacy event handlers
    socket.on('join_queue', () => {
      const userId = socket.data.userId;
      if (userId) {
        const userElo = socket.data.elo || 1200;
        this.handleQueueJoin(socket, { userId, elo: userElo });
      }
    });
    
    socket.on('leave_queue', () => this.handleQueueLeave(socket));
  }

  // Broadcast queue updates to all users in queue
  async broadcastQueueUpdate(): Promise<void> {
    try {
      const stats = await matchmakingService.getMatchmakingStats();
      
      this.io.emit('queue_update', {
        queueSize: stats.queueSize,
        estimatedWaitTime: Math.round(stats.avgWaitTime / 1000), // Convert to seconds
      });
    } catch (error) {
      console.error('Error broadcasting queue update:', error);
    }
  }

  // Setup periodic queue updates
  setupPeriodicUpdates(): void {
    setInterval(() => {
      this.broadcastQueueUpdate();
    }, 5000); // Every 5 seconds
  }
}
