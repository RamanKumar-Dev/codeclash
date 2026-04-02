import { Server, Socket } from 'socket.io';
import { 
  ClientToServerEvents, 
  ServerToClientEvents,
  BattleStateData,
  DamageLog,
  BattleStats,
  SpellCastRequest,
  SpellCastResult
} from '@code-clash/shared-types';
import { battleRoomService } from '../services/battle-room.service';
import { SpellService } from '../services/spell.service';
import { redisService } from './redis.service';
import { userService } from '../services/user.service';

export class BattleHandlers {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private spellService: SpellService;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
    this.spellService = new SpellService(redisService);
    this.setupRedisSubscriptions();
  }

  // Handle battle ready
  async handleBattleReady(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: { roomId: string }): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      // Verify user is in this battle room
      const userBattleRoom = await redisService.getUserBattleRoom(userId);
      if (!userBattleRoom || userBattleRoom !== data.roomId) {
        socket.emit('error', 'Invalid battle room');
        return;
      }

      // Mark user as ready
      const participants = await redisService.getBattleParticipants(data.roomId);
      const participant = participants.find(p => p.userId === userId);
      
      if (participant) {
        participant.isDisconnected = false;
        participant.lastActivity = new Date();
        await redisService.updateParticipant(data.roomId, userId, participant);
      }

      // Join battle room socket
      socket.join(`battle:${data.roomId}`);
      
      console.log(`User ${userId} is ready for battle ${data.roomId}`);
    } catch (error) {
      console.error('Error handling battle ready:', error);
      socket.emit('error', 'Internal server error');
    }
  }

  // Handle code submission
  async handleBattleSubmit(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: { code: string; language: string; roomId: string }): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      // Verify user is in this battle room
      const userBattleRoom = await redisService.getUserBattleRoom(userId);
      if (!userBattleRoom || userBattleRoom !== data.roomId) {
        socket.emit('error', 'Invalid battle room');
        return;
      }

      // Validate code
      if (!data.code || data.code.trim().length === 0) {
        socket.emit('error', 'Code cannot be empty');
        return;
      }

      // Validate language
      const supportedLanguages = ['javascript', 'python', 'java', 'cpp'];
      if (!supportedLanguages.includes(data.language)) {
        socket.emit('error', 'Unsupported language');
        return;
      }

      // Process submission
      await battleRoomService.handleSubmission(data.roomId, userId, data.code, data.language);
      
      console.log(`Code submission from ${userId} in battle ${data.roomId}`);
    } catch (error) {
      console.error('Error handling battle submit:', error);
      socket.emit('error', 'Internal server error');
    }
  }

  // Handle spell cast
  async handleBattleSpellCast(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: SpellCastRequest): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      // Verify user is in this battle room
      const userBattleRoom = await redisService.getUserBattleRoom(userId);
      if (!userBattleRoom || userBattleRoom !== data.roomId) {
        socket.emit('error', 'Invalid battle room');
        return;
      }

      // Get user data to verify spell ownership
      const user = await userService.getUserById(userId);
      if (!user || !user.spellsUnlocked.includes(data.spellId)) {
        socket.emit('error', 'Spell not owned');
        return;
      }

      // Cast spell using spell service
      const result = await this.spellService.castSpell(data, userId);
      
      if (result.success) {
        // Emit spell used event to both players
        this.io.to(`battle:${data.roomId}`).emit('battle:spell_used', result);
        
        // Apply spell effects in battle room service
        await battleRoomService.applySpellEffect(data.roomId, result.effect.type, userId, data.targetUserId);
        
        console.log(`Spell cast from ${userId} in battle ${data.roomId}: ${data.spellId}`);
      } else {
        socket.emit('error', result.error || 'Failed to cast spell');
      }
    } catch (error) {
      console.error('Error handling spell cast:', error);
      socket.emit('error', error.message || 'Internal server error');
    }
  }

  // Handle battle forfeit
  async handleBattleForfeit(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: { roomId: string }): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      // Verify user is in this battle room
      const userBattleRoom = await redisService.getUserBattleRoom(userId);
      if (!userBattleRoom || userBattleRoom !== data.roomId) {
        socket.emit('error', 'Invalid battle room');
        return;
      }

      // Process forfeit
      await battleRoomService.handleForfeit(data.roomId, userId);
      
      console.log(`User ${userId} forfeited battle ${data.roomId}`);
    } catch (error) {
      console.error('Error handling battle forfeit:', error);
      socket.emit('error', 'Internal server error');
    }
  }

  // Handle reconnection
  async handleBattleReconnect(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: { roomId: string }): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      // Verify user was in this battle room
      const userBattleRoom = await redisService.getUserBattleRoom(userId);
      if (!userBattleRoom || userBattleRoom !== data.roomId) {
        socket.emit('error', 'Invalid battle room');
        return;
      }

      // Handle reconnection
      await battleRoomService.handleReconnection(data.roomId, userId);
      
      // Re-join socket room
      socket.join(`battle:${data.roomId}`);
      
      console.log(`User ${userId} reconnected to battle ${data.roomId}`);
    } catch (error) {
      console.error('Error handling battle reconnect:', error);
      socket.emit('error', 'Internal server error');
    }
  }

  // Handle battle ping (for connection health)
  async handleBattlePing(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) return;

      // Update user's last activity in their current battle
      const battleRoom = await redisService.getUserBattleRoom(userId);
      if (battleRoom) {
        const participants = await redisService.getBattleParticipants(battleRoom);
        const participant = participants.find(p => p.userId === userId);
        
        if (participant) {
          participant.lastActivity = new Date();
          await redisService.updateParticipant(battleRoom, userId, participant);
        }
      }

      socket.emit('pong');
    } catch (error) {
      console.error('Error handling battle ping:', error);
    }
  }

  // Setup Redis subscriptions for battle events
  private setupRedisSubscriptions(): void {
    // Battle start events
    redisService.subscribe('battle:*:start', async (data: any) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:start', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:start', data);
      }
    });

    // Battle countdown events
    redisService.subscribe('battle:*:countdown', async (data: any) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:countdown', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:countdown', data);
      }
    });

    // Battle damage events
    redisService.subscribe('battle:*:damage', async (data: any) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:damage', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:damage', data);
      }
    });

    // Battle spell used events
    redisService.subscribe('battle:*:spell_used', async (data: any) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:spell_used', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:spell_used', data);
      }
    });

    // Battle time warning events
    redisService.subscribe('battle:*:time_warning', async (data: any) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:time_warning', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:time_warning', data);
      }
    });

    // Battle end events
    redisService.subscribe('battle:*:end', async (data: BattleStats) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:end', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:end', data);
        
        // Remove users from battle room
        const participants = await redisService.getBattleParticipants(roomId);
        participants.forEach(participant => {
          this.io.sockets.sockets.forEach(socket => {
            if (socket.data.userId === participant.userId) {
              socket.leave(`battle:${roomId}`);
            }
          });
        });
      }
    });

    // Battle reconnection events
    redisService.subscribe('battle:*:reconnecting', async (data: any) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:reconnecting', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:reconnecting', data);
      }
    });

    // Battle opponent reconnected events
    redisService.subscribe('battle:*:opponent_reconnected', async (data: any) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:opponent_reconnected', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:opponent_reconnected', data);
      }
    });

    // Battle opponent progress events
    redisService.subscribe('battle:*:opponent_progress', async (data: any) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:opponent_progress', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:opponent_progress', data);
      }
    });

    // Battle state update events
    redisService.subscribe('battle:*:state_update', async (data: BattleStateData) => {
      const roomId = this.extractRoomIdFromChannel('battle:*:state_update', data.channel);
      if (roomId) {
        this.io.to(`battle:${roomId}`).emit('battle:state_update', data);
      }
    });

    // Match found events (from matchmaking)
    redisService.subscribe('match_found:*', async (data: any) => {
      const userId = this.extractUserIdFromChannel('match_found:*', data.channel);
      if (userId) {
        // Find the socket for this user
        const socket = this.findSocketByUserId(userId);
        if (socket) {
          socket.emit('match:found', data);
          socket.join(`battle:${data.roomId}`);
        }
      }
    });
  }

  // Helper method to extract room ID from channel pattern
  private extractRoomIdFromChannel(pattern: string, channel: string): string | null {
    const regex = new RegExp(pattern.replace('*', '([^:]+)'));
    const match = channel.match(regex);
    return match ? match[1] : null;
  }

  // Helper method to extract user ID from channel pattern
  private extractUserIdFromChannel(pattern: string, channel: string): string | null {
    const regex = new RegExp(pattern.replace('*', '(.+)'));
    const match = channel.match(regex);
    return match ? match[1] : null;
  }

  // Helper method to find socket by user ID
  private findSocketByUserId(userId: string): Socket<ClientToServerEvents, ServerToClientEvents> | null {
    for (const socket of this.io.sockets.sockets.values()) {
      if (socket.data.userId === userId) {
        return socket;
      }
    }
    return null;
  }

  // Handle disconnection
  async handleDisconnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) return;

      const battleRoom = await redisService.getUserBattleRoom(userId);
      if (battleRoom) {
        await battleRoomService.handleDisconnection(battleRoom, userId);
      }
      
      console.log(`User ${userId} disconnected during battle`);
    } catch (error) {
      console.error('Error handling battle disconnection:', error);
    }
  }

  // Register all battle handlers
  registerHandlers(socket: Socket<ClientToServerEvents, ServerToClientEvents>): void {
    socket.on('battle:ready', (data) => this.handleBattleReady(socket, data));
    socket.on('battle:submit', (data) => this.handleBattleSubmit(socket, data));
    socket.on('battle:spell_cast', (data) => this.handleBattleSpellCast(socket, data));
    socket.on('battle:forfeit', (data) => this.handleBattleForfeit(socket, data));
    socket.on('battle:reconnect', (data) => this.handleBattleReconnect(socket, data));
    socket.on('battle:ping', () => this.handleBattlePing(socket));
    socket.on('disconnect', () => this.handleDisconnection(socket));

    // Legacy event handlers
    socket.on('submit_code', (data) => {
      if (socket.data.userId && socket.data.roomId) {
        this.handleBattleSubmit(socket, {
          code: data.code,
          language: data.language,
          roomId: socket.data.roomId,
        });
      }
    });
    
    socket.on('use_spell', (data) => {
      if (socket.data.userId && socket.data.roomId) {
        this.handleBattleSpellCast(socket, {
          spellType: data.spellType,
          roomId: socket.data.roomId,
          targetUserId: data.targetUserId,
        });
      }
    });
  }

  // Setup battle monitoring and cleanup
  setupBattleMonitoring(): void {
    // Monitor for inactive battles
    setInterval(async () => {
      try {
        // This would typically scan Redis for battles that need cleanup
        // Implementation depends on specific requirements
      } catch (error) {
        console.error('Error in battle monitoring:', error);
      }
    }, 60000); // Every minute
  }
}
