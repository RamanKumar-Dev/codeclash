import { Server, Socket } from 'socket.io';
import { createClient, RedisClientType } from 'redis';
import { PrismaClient } from '@prisma/client';
import { MatchmakingService } from './matchmakingService';
import { BattleService } from './battleService';
import { verifyJWT, validateInput, QueueJoinSchema, BattleSubmitSchema, SpellCastSchema, BattleReadySchema, JoinRoomSchema } from '../utils/validation';

let matchmakingService: MatchmakingService | null = null;
let battleService: BattleService | null = null;
let redis: RedisClientType | null = null;

export async function setupSocketHandlers(io: Server) {
  // Initialize Redis connection
  redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  await redis.connect();
  console.log('Connected to Redis for Socket.io services');

  // Initialize services
  const prisma = new PrismaClient();
  
  matchmakingService = new MatchmakingService(redis, prisma, io);
  battleService = new BattleService(redis, prisma, io);

  // Start matchmaking service
  await matchmakingService.startMatchmaking();

  // Socket authentication middleware
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = verifyJWT(token);
      
      (socket as any).userId = decoded.userId;
      (socket as any).username = decoded.username;
      (socket as any).elo = decoded.elo;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId;
    console.log(`User ${userId} connected: ${socket.id}`);

    // Store socket mapping
    if (redis) {
      await redis.hSet(`user_sockets:${userId}`, {
        socketId: socket.id,
        connectedAt: Date.now().toString()
      });
    }

    // Handle battle connections (check for reconnection)
    if (battleService) {
      await battleService.handleBattleConnection(socket, userId);
    }

    // Matchmaking events
    socket.on('queue:join', async (data: any) => {
      try {
        const validatedData = validateInput(QueueJoinSchema, data);
        const { elo } = validatedData;
        console.log(`User ${userId} joining matchmaking queue with ELO ${elo}`);
        
        if (matchmakingService) {
          await matchmakingService.addToQueue(userId, socket.id, elo);
          const queueSize = await matchmakingService.getQueueSize();
          socket.emit('queue:joined', { queueSize });
          io.emit('queue:size_update', { size: queueSize });
        }
        
      } catch (error) {
        console.error('Error joining queue:', error);
        socket.emit('error', { message: 'Failed to join queue' });
      }
    });

    socket.on('queue:leave', async () => {
      try {
        console.log(`User ${userId} leaving matchmaking queue`);
        
        if (matchmakingService) {
          await matchmakingService.removeFromQueue(userId);
          const queueSize = await matchmakingService.getQueueSize();
          socket.emit('queue:left');
          io.emit('queue:size_update', { size: queueSize });
        }
        
      } catch (error) {
        console.error('Error leaving queue:', error);
        socket.emit('error', { message: 'Failed to leave queue' });
      }
    });

    // Battle events
    socket.on('battle:submit', async (data: any) => {
      try {
        const validatedData = validateInput(BattleSubmitSchema, data);
        if (battleService) {
          await battleService.handleSubmission(socket, validatedData);
        }
      } catch (error) {
        console.error('Error in battle submit:', error);
        socket.emit('error', { message: 'Failed to submit code' });
      }
    });

    socket.on('battle:spell_cast', async (data: any) => {
      try {
        const validatedData = validateInput(SpellCastSchema, data);
        if (battleService) {
          await battleService.handleSpellCast(socket, validatedData);
        }
      } catch (error) {
        console.error('Error in spell cast:', error);
        socket.emit('error', { message: 'Failed to cast spell' });
      }
    });

    socket.on('battle:forfeit', async (data: any) => {
      try {
        if (battleService) {
          await battleService.handleForfeit(socket, data);
        }
      } catch (error) {
        console.error('Error in forfeit:', error);
        socket.emit('error', { message: 'Failed to forfeit' });
      }
    });

    socket.on('battle:ready', async (data: any) => {
      try {
        const validatedData = validateInput(BattleReadySchema, data);
        const { roomId } = validatedData;
        console.log(`User ${userId} ready for battle in room ${roomId}`);
        
        socket.join(roomId);
        
        // Check if both players are ready, then start countdown
        const roomSockets = await io.in(roomId).fetchSockets();
        if (roomSockets.length === 2 && battleService) {
          await battleService.startBattleCountdown(roomId);
        }
        
      } catch (error) {
        console.error('Error handling battle ready:', error);
        socket.emit('error', { message: 'Failed to ready up for battle' });
      }
    });

    // Room management
    socket.on('join_room', async (data: any) => {
      try {
        const validatedData = validateInput(JoinRoomSchema, data);
        const { roomId } = validatedData;
        socket.join(roomId);
        console.log(`User ${userId} joined room ${roomId}`);
        
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leave_room', async (data: any) => {
      try {
        const validatedData = validateInput(JoinRoomSchema, data);
        const { roomId } = validatedData;
        socket.leave(roomId);
        console.log(`User ${userId} left room ${roomId}`);
        
      } catch (error) {
        console.error('Error leaving room:', error);
        socket.emit('error', { message: 'Failed to leave room' });
      }
    });

    // Get queue status
    socket.on('queue:status', async () => {
      try {
        if (matchmakingService) {
          const queueSize = await matchmakingService.getQueueSize();
          const isInQueue = await matchmakingService.isPlayerInQueue(userId);
          socket.emit('queue:status_response', { queueSize, isInQueue });
        }
      } catch (error) {
        console.error('Error getting queue status:', error);
        socket.emit('error', { message: 'Failed to get queue status' });
      }
    });

    // Disconnection handling
    socket.on('disconnect', async () => {
      console.log(`User ${userId} disconnected: ${socket.id}`);
      
      // Remove from matchmaking queue if present
      if (matchmakingService && await matchmakingService.isPlayerInQueue(userId)) {
        await matchmakingService.removeFromQueue(userId);
        const queueSize = await matchmakingService.getQueueSize();
        io.emit('queue:size_update', { size: queueSize });
      }

      // Handle battle disconnection
      if (battleService) {
        await battleService.handleDisconnection(socket);
      }

      // Clean up socket mapping
      if (redis) {
        await redis.hDel(`user_sockets:${userId}`, 'socketId');
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });
  });

  console.log('Socket.io handlers configured');
}

// Export services for potential external access
export function getMatchmakingService(): MatchmakingService | null {
  return matchmakingService;
}

export function getBattleService(): BattleService | null {
  return battleService;
}

// Cleanup function
export async function cleanupSocketServices() {
  if (matchmakingService) {
    await matchmakingService.stopMatchmaking();
  }
  
  if (redis) {
    await redis.quit();
  }
  
  console.log('Socket.io services cleaned up');
}
