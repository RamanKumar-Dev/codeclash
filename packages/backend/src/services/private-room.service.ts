import { PrivateRoom, IPrivateRoom } from '../models/private-room.model';
import { redisService } from './redis.service';
import { battleRoomService } from './battle-room.service';
import { puzzleService } from './puzzle.service';
import { PrivateRoom as PrivateRoomType, PrivateRoomRequest } from '@code-clash/shared-types';
import { v4 as uuidv4 } from 'uuid';

export class PrivateRoomService {
  // Create a new private room
  async createPrivateRoom(
    creatorId: string,
    creatorUsername: string,
    options: PrivateRoomRequest = {}
  ): Promise<PrivateRoomType> {
    try {
      // Check if user already has an active private room
      const existingRoom = await PrivateRoom.findUserActiveRooms(creatorId);
      if (existingRoom.length > 0) {
        throw new Error('User already has an active private room');
      }

      // Create the room
      const room = await PrivateRoom.createPrivateRoom(creatorId, creatorUsername, options);

      // Store in Redis for quick access
      await redisService.setex(
        `private_room:${room.roomCode}`,
        1800, // 30 minutes
        JSON.stringify(room)
      );

      // Publish room creation
      await redisService.publish(`private_room_created:${creatorId}`, room);

      console.log(`Private room created: ${room.roomCode} by ${creatorUsername}`);
      return this.formatPrivateRoom(room);
    } catch (error) {
      console.error('Error creating private room:', error);
      throw error;
    }
  }

  // Join a private room
  async joinPrivateRoom(roomCode: string, guestId: string, guestUsername: string): Promise<PrivateRoomType> {
    try {
      // Find room by code
      const room = await PrivateRoom.findByRoomCode(roomCode.toUpperCase());
      if (!room) {
        throw new Error('Invalid room code or room expired');
      }

      // Check if guest is the creator
      if (room.creatorId === guestId) {
        throw new Error('Cannot join your own room');
      }

      // Check if room already has a guest
      if (room.guestId) {
        throw new Error('Room is already full');
      }

      // Add guest to room
      await room.addGuest(guestId, guestUsername);

      // Update Redis
      await redisService.setex(
        `private_room:${room.roomCode}`,
        1800,
        JSON.stringify(room)
      );

      // Publish room join
      await redisService.publish(`private_room_joined:${room.roomCode}`, room);

      console.log(`Guest ${guestUsername} joined private room ${roomCode}`);
      return this.formatPrivateRoom(room);
    } catch (error) {
      console.error('Error joining private room:', error);
      throw error;
    }
  }

  // Set player ready status
  async setPlayerReady(roomId: string, userId: string): Promise<PrivateRoomType> {
    try {
      const room = await PrivateRoom.findOne({ id: roomId });
      if (!room) {
        throw new Error('Room not found');
      }

      // Set ready status
      if (userId === room.creatorId) {
        await room.setCreatorReady(true);
      } else if (userId === room.guestId) {
        await room.setGuestReady(true);
      } else {
        throw new Error('User not in this room');
      }

      // Update Redis
      await redisService.setex(
        `private_room:${room.roomCode}`,
        1800,
        JSON.stringify(room)
      );

      // Publish ready status
      await redisService.publish(`private_room_ready:${room.roomCode}`, {
        userId,
        creatorReady: room.creatorReady,
        guestReady: room.guestReady,
        bothReady: room.creatorReady && room.guestReady,
      });

      // If both are ready, start countdown
      if (room.creatorReady && room.guestReady && room.state === 'ready') {
        await this.startBattleCountdown(room);
      }

      return this.formatPrivateRoom(room);
    } catch (error) {
      console.error('Error setting player ready:', error);
      throw error;
    }
  }

  // Leave private room
  async leavePrivateRoom(roomId: string, userId: string): Promise<void> {
    try {
      const room = await PrivateRoom.findOne({ id: roomId });
      if (!room) {
        return;
      }

      // If battle is active, handle it through battle service
      if (room.state === 'active' && room.battleRoomId) {
        await battleRoomService.handleForfeit(room.battleRoomId, userId);
        return;
      }

      // Remove user from room
      if (userId === room.creatorId) {
        // If creator leaves, cancel the room
        await room.delete();
      } else if (userId === room.guestId) {
        // If guest leaves, remove them
        room.guestId = undefined;
        room.guestUsername = undefined;
        room.guestReady = false;
        room.state = 'waiting';
        await room.save();
      }

      // Update Redis
      await redisService.setex(
        `private_room:${room.roomCode}`,
        1800,
        JSON.stringify(room)
      );

      // Publish room leave
      await redisService.publish(`private_room_left:${room.roomCode}`, {
        userId,
        roomState: room.state,
      });

      console.log(`User ${userId} left private room ${room.roomCode}`);
    } catch (error) {
      console.error('Error leaving private room:', error);
      throw error;
    }
  }

  // Start battle countdown
  private async startBattleCountdown(room: IPrivateRoom): Promise<void> {
    try {
      let countdown = 3;
      
      const countdownInterval = setInterval(async () => {
        countdown--;
        
        await redisService.publish(`private_room_countdown:${room.roomCode}`, {
          seconds: countdown,
        });

        if (countdown <= 0) {
          clearInterval(countdownInterval);
          await this.startPrivateBattle(room);
        }
      }, 1000);

      // Store countdown timer
      await redisService.setex(
        `private_room_timer:${room.roomCode}`,
        5,
        JSON.stringify({ active: true })
      );
    } catch (error) {
      console.error('Error starting battle countdown:', error);
    }
  }

  // Start the actual private battle
  private async startPrivateBattle(room: IPrivateRoom): Promise<void> {
    try {
      // Select puzzle if not specified
      let puzzleId = room.puzzleId;
      if (!puzzleId) {
        const avgElo = 1200; // Default ELO for private matches
        const puzzle = await puzzleService.selectPuzzleByElo(avgElo);
        puzzleId = puzzle?.id;
      }

      if (!puzzleId) {
        throw new Error('No puzzle available for private battle');
      }

      // Create battle room
      const battleRoomId = uuidv4();
      await battleRoomService.initializeBattle(battleRoomId, { id: puzzleId } as any);

      // Update private room
      await room.startBattle(battleRoomId);

      // Update Redis
      await redisService.setex(
        `private_room:${room.roomCode}`,
        1800,
        JSON.stringify(room)
      );

      // Publish battle start
      await redisService.publish(`private_battle_started:${room.roomCode}`, {
        battleRoomId,
        puzzleId,
        room,
      });

      console.log(`Private battle started in room ${room.roomCode}`);
    } catch (error) {
      console.error('Error starting private battle:', error);
      // Reset room state on error
      room.state = 'ready';
      room.creatorReady = false;
      room.guestReady = false;
      await room.save();
    }
  }

  // Get private room by code
  async getPrivateRoom(roomCode: string): Promise<PrivateRoomType | null> {
    try {
      // Try Redis first
      const cachedRoom = await redisService.client.get(`private_room:${roomCode.toUpperCase()}`);
      if (cachedRoom) {
        return JSON.parse(cachedRoom);
      }

      // Fallback to database
      const room = await PrivateRoom.findByRoomCode(roomCode.toUpperCase());
      return room ? this.formatPrivateRoom(room) : null;
    } catch (error) {
      console.error('Error getting private room:', error);
      return null;
    }
  }

  // Get user's active private room
  async getUserActiveRoom(userId: string): Promise<PrivateRoomType | null> {
    try {
      const rooms = await PrivateRoom.findUserActiveRooms(userId);
      return rooms.length > 0 ? this.formatPrivateRoom(rooms[0]) : null;
    } catch (error) {
      console.error('Error getting user active room:', error);
      return null;
    }
  }

  // End private battle
  async endPrivateBattle(roomId: string, winnerId: string): Promise<void> {
    try {
      const room = await PrivateRoom.findOne({ id: roomId });
      if (!room) {
        return;
      }

      await room.endBattle(winnerId);

      // Update Redis
      await redisService.setex(
        `private_room:${room.roomCode}`,
        300, // 5 minutes after battle ends
        JSON.stringify(room)
      );

      // Publish battle end
      await redisService.publish(`private_battle_ended:${room.roomCode}`, {
        room: this.formatPrivateRoom(room),
        winnerId,
      });

      console.log(`Private battle ended in room ${room.roomCode}, winner: ${winnerId}`);
    } catch (error) {
      console.error('Error ending private battle:', error);
    }
  }

  // Clean up expired rooms
  async cleanupExpiredRooms(): Promise<void> {
    try {
      const expiredRooms = await PrivateRoom.findExpiredRooms();
      
      for (const room of expiredRooms) {
        // Notify users
        if (room.creatorId) {
          await redisService.publish(`private_room_expired:${room.creatorId}`, {
            roomCode: room.roomCode,
            message: 'Room expired due to inactivity',
          });
        }
        
        if (room.guestId) {
          await redisService.publish(`private_room_expired:${room.guestId}`, {
            roomCode: room.roomCode,
            message: 'Room expired due to inactivity',
          });
        }

        // Delete room
        await room.delete();
        
        // Remove from Redis
        await redisService.client.del(`private_room:${room.roomCode}`);
      }

      if (expiredRooms.length > 0) {
        console.log(`Cleaned up ${expiredRooms.length} expired private rooms`);
      }
    } catch (error) {
      console.error('Error cleaning up expired rooms:', error);
    }
  }

  // Get room statistics
  async getRoomStats(): Promise<{
    totalRooms: number;
    activeRooms: number;
    waitingRooms: number;
    readyRooms: number;
    battlesInProgress: number;
  }> {
    try {
      const stats = await PrivateRoom.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            waiting: {
              $sum: { $cond: [{ $eq: ['$state', 'waiting'] }, 1, 0] }
            },
            ready: {
              $sum: { $cond: [{ $eq: ['$state', 'ready'] }, 1, 0] }
            },
            active: {
              $sum: { $cond: [{ $eq: ['$state', 'active'] }, 1, 0] }
            },
          },
        },
      ]);

      const result = stats[0] || {
        total: 0,
        waiting: 0,
        ready: 0,
        active: 0,
      };

      return {
        totalRooms: result.total,
        activeRooms: result.active,
        waitingRooms: result.waiting,
        readyRooms: result.ready,
        battlesInProgress: result.active,
      };
    } catch (error) {
      console.error('Error getting room stats:', error);
      return {
        totalRooms: 0,
        activeRooms: 0,
        waitingRooms: 0,
        readyRooms: 0,
        battlesInProgress: 0,
      };
    }
  }

  // Helper method to format private room for API response
  private formatPrivateRoom(room: IPrivateRoom): PrivateRoomType {
    return {
      id: room.id,
      roomCode: room.roomCode,
      creatorId: room.creatorId,
      creatorUsername: room.creatorUsername,
      guestId: room.guestId,
      guestUsername: room.guestUsername,
      isRanked: room.isRanked,
      puzzleId: room.puzzleId,
      state: room.state,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
    };
  }

  // Extend room expiration
  async extendRoomExpiration(roomId: string, minutes: number): Promise<void> {
    try {
      const room = await PrivateRoom.findOne({ id: roomId });
      if (!room) {
        throw new Error('Room not found');
      }

      await room.extendExpiration(minutes);

      // Update Redis
      await redisService.setex(
        `private_room:${room.roomCode}`,
        minutes * 60,
        JSON.stringify(room)
      );

      console.log(`Extended expiration for room ${room.roomCode} by ${minutes} minutes`);
    } catch (error) {
      console.error('Error extending room expiration:', error);
      throw error;
    }
  }
}

export const privateRoomService = new PrivateRoomService();
