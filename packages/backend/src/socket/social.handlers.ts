import { Server, Socket } from 'socket.io';
import { 
  SocialClientToServerEvents, 
  SocialServerToClientEvents,
  FriendRequest,
  Friend,
  OnlineStatus,
  PrivateRoomRequest,
  SpectatorBattle,
  SpectatorChat,
  LobbyStats,
  RecentBattle,
  NewsItem
} from '@code-clash/shared-types';
import { friendService } from '../services/friend.service';
import { privateRoomService } from '../services/private-room.service';
import { spectatorService } from '../services/spectator.service';
import { matchmakingService } from '../services/matchmaking.service';
import { redisService } from '../services/redis.service';

export class SocialHandlers {
  private io: Server<SocialClientToServerEvents, SocialServerToClientEvents>;

  constructor(io: Server<SocialClientToServerEvents, SocialServerToClientEvents>) {
    this.io = io;
    this.setupRedisSubscriptions();
  }

  // Friend system handlers
  async handleFriendRequest(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, username: string): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      const friendRequest = await friendService.sendFriendRequest(userId, username);
      
      // Notify the target user if they're online
      const targetSocket = this.findSocketByUserId(friendRequest.toUserId);
      if (targetSocket) {
        targetSocket.emit('friends:request_received', friendRequest);
      }

      socket.emit('friends:request_sent', friendRequest);
      console.log(`Friend request sent: ${userId} -> ${username}`);
    } catch (error) {
      console.error('Error handling friend request:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  async handleFriendAccept(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, userId: string): Promise<void> {
    try {
      const currentUserId = socket.data.userId;
      if (!currentUserId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      const friend = await friendService.acceptFriendRequest(currentUserId, userId);
      
      // Notify both users
      const userSocket = this.findSocketByUserId(currentUserId);
      const friendSocket = this.findSocketByUserId(userId);

      if (userSocket) {
        userSocket.emit('friends:request_accepted', friend);
      }
      
      if (friendSocket) {
        friendSocket.emit('friends:accepted', {
          userId: currentUserId,
          username: socket.data.username,
          elo: socket.data.elo,
        });
      }

      console.log(`Friend request accepted: ${currentUserId} <-> ${userId}`);
    } catch (error) {
      console.error('Error handling friend accept:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  async handleFriendDecline(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, userId: string): Promise<void> {
    try {
      const currentUserId = socket.data.userId;
      if (!currentUserId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      await friendService.declineFriendRequest(currentUserId, userId);
      
      // Notify the requester
      const requesterSocket = this.findSocketByUserId(userId);
      if (requesterSocket) {
        requesterSocket.emit('friends:declined', {
          userId: currentUserId,
          username: socket.data.username,
        });
      }

      socket.emit('friends:decline_sent', { userId });
      console.log(`Friend request declined: ${currentUserId} declined ${userId}`);
    } catch (error) {
      console.error('Error handling friend decline:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  async handleFriendRemove(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, userId: string): Promise<void> {
    try {
      const currentUserId = socket.data.userId;
      if (!currentUserId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      await friendService.removeFriend(currentUserId, userId);
      
      // Notify both users
      const userSocket = this.findSocketByUserId(currentUserId);
      const friendSocket = this.findSocketByUserId(userId);

      if (userSocket) {
        userSocket.emit('friends:removed', { userId });
      }
      
      if (friendSocket) {
        friendSocket.emit('friends:removed', { userId: currentUserId });
      }

      console.log(`Friend removed: ${currentUserId} removed ${userId}`);
    } catch (error) {
      console.error('Error handling friend remove:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  async handleFriendOnlineStatus(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      const friends = await friendService.getOnlineFriends(userId);
      socket.emit('friends:online_status', friends);
    } catch (error) {
      console.error('Error getting online friends:', error);
      socket.emit('error', 'Failed to get online friends');
    }
  }

  // Private match handlers
  async handlePrivateCreate(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, data: PrivateRoomRequest): Promise<void> {
    try {
      const userId = socket.data.userId;
      const username = socket.data.username;
      
      if (!userId || !username) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      const room = await privateRoomService.createPrivateRoom(userId, username, data);
      
      // Join socket to room
      socket.join(`private:${room.id}`);
      
      socket.emit('private:room_created', room);
      console.log(`Private room created: ${room.roomCode} by ${username}`);
    } catch (error) {
      console.error('Error creating private room:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  async handlePrivateJoin(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, roomCode: string): Promise<void> {
    try {
      const userId = socket.data.userId;
      const username = socket.data.username;
      
      if (!userId || !username) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      const room = await privateRoomService.joinPrivateRoom(roomCode, userId, username);
      
      // Join socket to room
      socket.join(`private:${room.id}`);
      
      // Notify both players
      this.io.to(`private:${room.id}`).emit('private:room_joined', room);
      
      console.log(`User ${username} joined private room ${roomCode}`);
    } catch (error) {
      console.error('Error joining private room:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  async handlePrivateReady(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, roomId: string): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      const room = await privateRoomService.setPlayerReady(roomId, userId);
      
      // Notify all players in room
      this.io.to(`private:${roomId}`).emit('private:player_ready', {
        userId,
        creatorReady: room.creatorReady,
        guestReady: room.guestReady,
        bothReady: room.creatorReady && room.guestReady,
      });

      console.log(`Player ${userId} ready in private room ${roomId}`);
    } catch (error) {
      console.error('Error setting ready status:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  async handlePrivateLeave(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, roomId: string): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      await privateRoomService.leavePrivateRoom(roomId, userId);
      
      // Leave socket room
      socket.leave(`private:${roomId}`);
      
      // Notify remaining player
      this.io.to(`private:${roomId}`).emit('private:player_left', { userId });

      console.log(`User ${userId} left private room ${roomId}`);
    } catch (error) {
      console.error('Error leaving private room:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  // Spectator handlers
  async handleSpectatorJoin(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, battleId: string): Promise<void> {
    try {
      const userId = socket.data.userId;
      const username = socket.data.username;
      
      const spectator = await spectatorService.joinSpectator(battleId, {
        userId,
        username,
        isAnonymous: !userId,
      });

      // Join spectator room
      socket.join(`spectator:${battleId}`);
      
      // Join battle room for receiving battle events
      socket.join(`battle:${battleId}`);
      
      // Send chat history
      const chatHistory = await spectatorService.getChatHistory(battleId);
      socket.emit('spectator:chat_history', chatHistory);
      
      // Notify spectators
      socket.emit('spectator:joined', battleId, spectator.userId ? await spectatorService.getSpectatorCount(battleId) : 0);
      
      console.log(`Spectator ${username} joined battle ${battleId}`);
    } catch (error) {
      console.error('Error joining spectator:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  async handleSpectatorLeave(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, battleId: string): Promise<void> {
    try {
      const userId = socket.data.userId || `anonymous_${socket.id}`;
      
      await spectatorService.leaveSpectator(battleId, userId);
      
      // Leave rooms
      socket.leave(`spectator:${battleId}`);
      socket.leave(`battle:${battleId}`);
      
      socket.emit('spectator:left', battleId);
      console.log(`Spectator ${userId} left battle ${battleId}`);
    } catch (error) {
      console.error('Error leaving spectator:', error);
    }
  }

  async handleSpectatorChat(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>, battleId: string, message: string): Promise<void> {
    try {
      const userId = socket.data.userId || `anonymous_${socket.id}`;
      const username = socket.data.username || `Anonymous${Math.floor(Math.random() * 1000)}`;
      
      const chatMessage = await spectatorService.sendSpectatorChat(battleId, userId, message);
      
      // Broadcast to all spectators
      this.io.to(`spectator:${battleId}`).emit('spectator:chat', chatMessage);
      
      console.log(`Spectator chat in ${battleId}: ${username}: ${message}`);
    } catch (error) {
      console.error('Error sending spectator chat:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  async handleSpectatorToggleAnonymous(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'Anonymous toggle only available for logged-in users');
        return;
      }

      // Find which battle the user is spectating
      const rooms = Array.from(socket.rooms).filter(room => room.startsWith('spectator:'));
      if (rooms.length === 0) {
        socket.emit('error', 'Not currently spectating any battle');
        return;
      }

      const battleId = rooms[0].replace('spectator:', '');
      const spectator = await spectatorService.toggleAnonymous(battleId, userId);
      
      // Broadcast change to other spectators
      socket.to(`spectator:${battleId}`).emit('spectator:updated', spectator);
      
      console.log(`Spectator ${userId} toggled anonymous mode in battle ${battleId}`);
    } catch (error) {
      console.error('Error toggling anonymous mode:', error);
      socket.emit('error', (error as Error).message);
    }
  }

  // Lobby handlers
  async handleLobbyStats(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>): Promise<void> {
    try {
      const [queueSize, onlineUsers, activeBattles, featuredBattle] = await Promise.all([
        matchmakingService.getQueueSize(),
        redisService.client.get('online_users_count') || '0',
        redisService.client.get('active_battles_count') || '0',
        spectatorService.getFeaturedBattle(),
      ]);

      const stats: LobbyStats = {
        activeBattles: parseInt(activeBattles as string),
        onlineUsers: parseInt(onlineUsers as string),
        queueSize,
        featuredBattle: featuredBattle || undefined,
      };

      socket.emit('lobby:stats', stats);
    } catch (error) {
      console.error('Error getting lobby stats:', error);
      socket.emit('error', 'Failed to get lobby stats');
    }
  }

  async handleLobbyRecentBattles(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', 'User not authenticated');
        return;
      }

      // Mock recent battles - would fetch from database
      const recentBattles: RecentBattle[] = [];
      socket.emit('lobby:recent_battles', recentBattles);
    } catch (error) {
      console.error('Error getting recent battles:', error);
      socket.emit('error', 'Failed to get recent battles');
    }
  }

  async handleLobbyNews(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>): Promise<void> {
    try {
      // Mock news - would fetch from database
      const news: NewsItem[] = [];
      socket.emit('lobby:news', news);
    } catch (error) {
      console.error('Error getting news:', error);
      socket.emit('error', 'Failed to get news');
    }
  }

  // Setup Redis subscriptions for real-time updates
  private setupRedisSubscriptions(): void {
    // Friend request notifications
    redisService.subscribe('friend_request:*', async (data: any) => {
      const userId = this.extractUserIdFromChannel('friend_request:*', data.channel);
      if (userId) {
        const socket = this.findSocketByUserId(userId);
        if (socket) {
          socket.emit('friends:request_received', data);
        }
      }
    });

    // Friend status updates
    redisService.subscribe('friend_status:*', async (data: any) => {
      const userId = this.extractUserIdFromChannel('friend_status:*', data.channel);
      if (userId) {
        const socket = this.findSocketByUserId(userId);
        if (socket) {
          socket.emit('friends:status_update', data);
        }
      }
    });

    // Private room events
    redisService.subscribe('private_room_*', async (data: any) => {
      // Handle various private room events
      if (data.channel.includes('created')) {
        const creatorId = data.fromUserId || data.creatorId;
        const socket = this.findSocketByUserId(creatorId);
        if (socket) {
          socket.emit('private:room_created', data);
        }
      }
    });

    // Spectator events
    redisService.subscribe('spectator_*', async (data: any) => {
      if (data.channel.includes('chat')) {
        const battleId = this.extractBattleIdFromChannel('spectator:*:chat', data.channel);
        if (battleId) {
          this.io.to(`spectator:${battleId}`).emit('spectator:chat', data);
        }
      }
    });

    // Queue updates
    redisService.subscribe('queue_update', async (data: any) => {
      this.io.emit('lobby:queue_update', data.queueSize, data.estimatedWaitTime);
    });
  }

  // Helper methods
  private findSocketByUserId(userId: string): Socket<SocialClientToServerEvents, SocialServerToClientEvents> | null {
    for (const socket of this.io.sockets.sockets.values()) {
      if (socket.data.userId === userId) {
        return socket;
      }
    }
    return null;
  }

  private extractUserIdFromChannel(pattern: string, channel: string): string | null {
    const regex = new RegExp(pattern.replace('*', '(.+)'));
    const match = channel.match(regex);
    return match ? match[1] : null;
  }

  private extractBattleIdFromChannel(pattern: string, channel: string): string | null {
    const regex = new RegExp(pattern.replace('*', '([^:]+)'));
    const match = channel.match(regex);
    return match ? match[1] : null;
  }

  // Register all social handlers
  registerHandlers(socket: Socket<SocialClientToServerEvents, SocialServerToClientEvents>): void {
    // Friend events
    socket.on('friends:request', (username) => this.handleFriendRequest(socket, username));
    socket.on('friends:accept', (userId) => this.handleFriendAccept(socket, userId));
    socket.on('friends:decline', (userId) => this.handleFriendDecline(socket, userId));
    socket.on('friends:remove', (userId) => this.handleFriendRemove(socket, userId));
    socket.on('friends:online_status', () => this.handleFriendOnlineStatus(socket));
    
    // Private match events
    socket.on('private:create', (data) => this.handlePrivateCreate(socket, data));
    socket.on('private:join', (roomCode) => this.handlePrivateJoin(socket, roomCode));
    socket.on('private:ready', (roomId) => this.handlePrivateReady(socket, roomId));
    socket.on('private:leave', (roomId) => this.handlePrivateLeave(socket, roomId));
    
    // Spectator events
    socket.on('spectator:join', (battleId) => this.handleSpectatorJoin(socket, battleId));
    socket.on('spectator:leave', (battleId) => this.handleSpectatorLeave(socket, battleId));
    socket.on('spectator:chat', (battleId, message) => this.handleSpectatorChat(socket, battleId, message));
    socket.on('spectator:toggle_anonymous', () => this.handleSpectatorToggleAnonymous(socket));
    
    // Lobby events
    socket.on('lobby:stats', () => this.handleLobbyStats(socket));
    socket.on('lobby:recent_battles', () => this.handleLobbyRecentBattles(socket));
    socket.on('lobby:news', () => this.handleLobbyNews(socket));
  }
}
