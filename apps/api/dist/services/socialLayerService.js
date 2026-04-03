"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialLayerService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class SocialLayerService {
    constructor(redis, prisma, io, config) {
        // Default configuration
        this.DEFAULT_CONFIG = {
            heartbeatInterval: 30000, // 30 seconds
            roomCodeExpiry: 3600000, // 1 hour
            maxSpectators: 50,
            spectatorChatRateLimit: 3, // 3 messages per minute
            friendListMaxSize: 100,
        };
        this.redis = redis;
        this.prisma = prisma;
        this.io = io;
        this.config = { ...this.DEFAULT_CONFIG, ...config };
    }
    // Handle user heartbeat for online status
    async handleHeartbeat(socket) {
        const userId = socket.userId;
        if (!userId)
            return;
        try {
            // Update online status
            await this.redis.setEx(`online:${userId}`, Math.ceil(this.config.heartbeatInterval / 1000) + 10, // 10 second buffer
            JSON.stringify({
                userId,
                socketId: socket.id,
                lastSeen: Date.now(),
            }));
            // Update user's last activity
            await this.prisma.user.update({
                where: { id: userId },
                data: { lastActiveAt: new Date() },
            });
            // Update friends' online lists
            await this.updateFriendsOnlineStatus(userId, true);
        }
        catch (error) {
            console.error('Error handling heartbeat:', error);
        }
    }
    // Handle user disconnect
    async handleDisconnect(socket) {
        const userId = socket.userId;
        if (!userId)
            return;
        try {
            // Remove from online status (will expire naturally)
            await this.redis.del(`online:${userId}`);
            // Update friends' online lists
            await this.updateFriendsOnlineStatus(userId, false);
            // Leave all private rooms
            await this.leaveAllPrivateRooms(userId);
            console.log(`User ${userId} went offline`);
        }
        catch (error) {
            console.error('Error handling disconnect:', error);
        }
    }
    // Update friends' online status
    async updateFriendsOnlineStatus(userId, isOnline) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { friends: true },
            });
            if (!user?.friends.length)
                return;
            // Notify all friends
            for (const friendId of user.friends) {
                const friendSocket = await this.getUserSocket(friendId);
                if (friendSocket) {
                    friendSocket.emit('friend:status_change', {
                        userId,
                        isOnline,
                        timestamp: Date.now(),
                    });
                }
            }
        }
        catch (error) {
            console.error('Error updating friends online status:', error);
        }
    }
    // Get user's online friends
    async getOnlineFriends(userId) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { friends: true },
            });
            if (!user?.friends.length)
                return [];
            const onlineFriends = [];
            for (const friendId of user.friends) {
                const onlineData = await this.redis.get(`online:${friendId}`);
                if (onlineData) {
                    const friend = await this.prisma.user.findUnique({
                        where: { id: friendId },
                        select: { id: true, username: true, elo: true },
                    });
                    if (friend) {
                        onlineFriends.push({
                            ...friend,
                            isOnline: true,
                            lastSeen: JSON.parse(onlineData).lastSeen,
                        });
                    }
                }
            }
            return onlineFriends;
        }
        catch (error) {
            console.error('Error getting online friends:', error);
            return [];
        }
    }
    // Create private room
    async createPrivateRoom(createdBy, settings) {
        try {
            const roomCode = this.generateRoomCode();
            const roomId = `private_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
            const room = {
                id: roomId,
                roomCode,
                createdBy,
                maxPlayers: settings.maxPlayers || 2,
                currentPlayers: [createdBy],
                spectators: [],
                settings: {
                    battleType: settings.battleType || 'casual',
                    difficulty: settings.difficulty || 'medium',
                    timeLimit: settings.timeLimit || 300,
                    maxSpectators: Math.min(settings.maxSpectators || 10, this.config.maxSpectators),
                },
                status: 'waiting',
                expiresAt: new Date(Date.now() + this.config.roomCodeExpiry),
                createdAt: new Date(),
            };
            // Store in Redis
            const roomKey = `private_room:${roomCode}`;
            await this.redis.setEx(roomKey, Math.ceil(this.config.roomCodeExpiry / 1000), JSON.stringify(room));
            // Add creator to room
            await this.joinPrivateRoom(createdBy, roomCode);
            console.log(`Created private room: ${roomCode} by ${createdBy}`);
            return { roomCode, room };
        }
        catch (error) {
            console.error('Error creating private room:', error);
            throw error;
        }
    }
    // Join private room
    async joinPrivateRoom(userId, roomCode) {
        try {
            const roomKey = `private_room:${roomCode}`;
            const roomJson = await this.redis.get(roomKey);
            if (!roomJson) {
                throw new Error('Room not found or expired');
            }
            const room = JSON.parse(roomJson);
            // Check if room is full
            if (room.currentPlayers.length >= room.maxPlayers) {
                throw new Error('Room is full');
            }
            // Check if user is already in room
            if (!room.currentPlayers.includes(userId)) {
                room.currentPlayers.push(userId);
            }
            // Update room in Redis
            await this.redis.setEx(roomKey, Math.ceil(this.config.roomCodeExpiry / 1000), JSON.stringify(room));
            // Join socket room
            const socket = await this.getUserSocket(userId);
            if (socket) {
                socket.join(roomCode);
                socket.emit('private_room:joined', { room });
            }
            // Notify room members
            this.io.to(roomCode).emit('private_room:player_joined', {
                userId,
                playerCount: room.currentPlayers.length,
            });
            console.log(`User ${userId} joined private room ${roomCode}`);
            return room;
        }
        catch (error) {
            console.error('Error joining private room:', error);
            throw error;
        }
    }
    // Leave private room
    async leavePrivateRoom(userId, roomCode) {
        try {
            const roomKey = `private_room:${roomCode}`;
            const roomJson = await this.redis.get(roomKey);
            if (!roomJson)
                return;
            const room = JSON.parse(roomJson);
            // Remove user from room
            room.currentPlayers = room.currentPlayers.filter(id => id !== userId);
            room.spectators = room.spectators.filter(id => id !== userId);
            // Update room or delete if empty
            if (room.currentPlayers.length === 0 && room.spectators.length === 0) {
                await this.redis.del(roomKey);
                console.log(`Deleted empty private room ${roomCode}`);
            }
            else {
                await this.redis.setEx(roomKey, Math.ceil(this.config.roomCodeExpiry / 1000), JSON.stringify(room));
            }
            // Leave socket room
            const socket = await this.getUserSocket(userId);
            if (socket) {
                socket.leave(roomCode);
                socket.emit('private_room:left', { roomCode });
            }
            // Notify room members
            this.io.to(roomCode).emit('private_room:player_left', {
                userId,
                playerCount: room.currentPlayers.length,
            });
            console.log(`User ${userId} left private room ${roomCode}`);
        }
        catch (error) {
            console.error('Error leaving private room:', error);
        }
    }
    // Leave all private rooms for user
    async leaveAllPrivateRooms(userId) {
        try {
            const patterns = [`private_room:*`];
            for (const pattern of patterns) {
                const keys = await this.redis.keys(pattern);
                for (const key of keys) {
                    const roomJson = await this.redis.get(key);
                    if (!roomJson)
                        continue;
                    const room = JSON.parse(roomJson);
                    const roomCode = room.roomCode;
                    if (room.currentPlayers.includes(userId) || room.spectators.includes(userId)) {
                        await this.leavePrivateRoom(userId, roomCode);
                    }
                }
            }
        }
        catch (error) {
            console.error('Error leaving all private rooms:', error);
        }
    }
    // Generate room code
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    // Get live battles with pagination
    async getLiveBattles(page = 1, limit = 20) {
        try {
            const battleKeys = await this.redis.keys('battle:*');
            const liveBattles = [];
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            for (let i = startIndex; i < Math.min(endIndex, battleKeys.length); i++) {
                const key = battleKeys[i];
                const battleJson = await this.redis.get(key);
                if (!battleJson)
                    continue;
                const battle = JSON.parse(battleJson);
                if (battle.status === 'ACTIVE') {
                    const spectatorCount = await this.redis.sCard(`battle_spectators:${battle.roomId}`);
                    liveBattles.push({
                        battleId: battle.id,
                        roomId: battle.roomId,
                        player1: {
                            userId: battle.player1Id,
                            username: battle.player1.username,
                            elo: battle.player1.elo,
                            hp: battle.player1.hp,
                            progress: battle.player1.progress || 0,
                        },
                        player2: {
                            userId: battle.player2Id,
                            username: battle.player2.username,
                            elo: battle.player2.elo,
                            hp: battle.player2.hp,
                            progress: battle.player2.progress || 0,
                        },
                        puzzleTitle: battle.puzzle?.title || 'Unknown',
                        status: battle.status,
                        spectatorCount,
                        isFeatured: battle.isFeatured || false,
                        startedAt: new Date(battle.startTime),
                    });
                }
            }
            return liveBattles;
        }
        catch (error) {
            console.error('Error getting live battles:', error);
            return [];
        }
    }
    // Join battle as spectator
    async joinBattleAsSpectator(userId, roomId) {
        try {
            const battleState = await this.redis.get(`battle:${roomId}`);
            if (!battleState) {
                throw new Error('Battle not found');
            }
            const battle = JSON.parse(battleState);
            const spectatorKey = `battle_spectators:${roomId}`;
            const currentSpectators = await this.redis.sCard(spectatorKey);
            if (currentSpectators >= this.config.maxSpectators) {
                throw new Error('Battle is full');
            }
            // Add to spectators
            await this.redis.sAdd(spectatorKey, userId);
            await this.redis.expire(spectatorKey, 3600); // 1 hour TTL
            // Join socket room
            const socket = await this.getUserSocket(userId);
            if (socket) {
                socket.join(roomId);
                socket.emit('battle:spectator_joined', { battle });
            }
            // Notify players
            this.io.to(roomId).emit('battle:spectator_count_update', {
                count: currentSpectators + 1,
            });
            console.log(`User ${userId} joined battle ${roomId} as spectator`);
            return true;
        }
        catch (error) {
            console.error('Error joining battle as spectator:', error);
            return false;
        }
    }
    // Handle spectator chat with rate limiting
    async handleSpectatorChat(socket, data) {
        const userId = socket.userId;
        const { message, roomId } = data;
        if (!userId || !message || !roomId)
            return;
        try {
            // Rate limiting check
            const rateLimitKey = `chat_rate_limit:${userId}:${roomId}`;
            const messageCount = await this.redis.incr(rateLimitKey);
            if (messageCount === 1) {
                await this.redis.expire(rateLimitKey, 60); // 1 minute window
            }
            if (messageCount > this.config.spectatorChatRateLimit) {
                socket.emit('chat:rate_limited', {
                    message: 'Please wait before sending another message',
                    resetTime: Date.now() + 60000,
                });
                return;
            }
            // Basic profanity filter
            const filteredMessage = this.filterProfanity(message);
            // Get user info
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { username: true, role: true },
            });
            if (!user)
                return;
            // Broadcast chat message
            const chatMessage = {
                id: crypto_1.default.randomUUID(),
                userId,
                username: user.username,
                role: user.role,
                message: filteredMessage,
                timestamp: Date.now(),
                isSpectator: true,
            };
            this.io.to(roomId).emit('chat:message', chatMessage);
        }
        catch (error) {
            console.error('Error handling spectator chat:', error);
        }
    }
    // Basic profanity filter
    filterProfanity(message) {
        const profanityList = ['damn', 'hell', 'shit', 'fuck', 'bitch', 'ass'];
        let filtered = message.toLowerCase();
        for (const word of profanityList) {
            const regex = new RegExp(word, 'gi');
            filtered = filtered.replace(regex, '*'.repeat(word.length));
        }
        return filtered;
    }
    // Feature battle (admin only)
    async featureBattle(roomId, featured) {
        try {
            const battleState = await this.redis.get(`battle:${roomId}`);
            if (!battleState) {
                throw new Error('Battle not found');
            }
            const battle = JSON.parse(battleState);
            battle.isFeatured = featured;
            await this.redis.setEx(`battle:${roomId}`, 1800, JSON.stringify(battle));
            // Update live battles list
            this.io.emit('battle:featured_update', {
                roomId,
                isFeatured: featured,
            });
            console.log(`Battle ${roomId} ${featured ? 'featured' : 'unfeatured'}`);
        }
        catch (error) {
            console.error('Error featuring battle:', error);
            throw error;
        }
    }
    // Get user socket
    async getUserSocket(userId) {
        try {
            const onlineData = await this.redis.get(`online:${userId}`);
            if (!onlineData)
                return null;
            const { socketId } = JSON.parse(onlineData);
            return this.io.sockets.sockets.get(socketId) || null;
        }
        catch (error) {
            console.error('Error getting user socket:', error);
            return null;
        }
    }
    // Start heartbeat monitoring
    startHeartbeatMonitoring() {
        setInterval(async () => {
            try {
                const onlineKeys = await this.redis.keys('online:*');
                const now = Date.now();
                for (const key of onlineKeys) {
                    const onlineData = await this.redis.get(key);
                    if (!onlineData)
                        continue;
                    const { lastSeen } = JSON.parse(onlineData);
                    // Remove users who haven't sent heartbeat in 2x interval
                    if (now - lastSeen > this.config.heartbeatInterval * 2) {
                        const userId = key.replace('online:', '');
                        await this.redis.del(key);
                        await this.updateFriendsOnlineStatus(userId, false);
                    }
                }
            }
            catch (error) {
                console.error('Error in heartbeat monitoring:', error);
            }
        }, this.config.heartbeatInterval);
        console.log('Heartbeat monitoring started');
    }
    // Cleanup expired private rooms
    async cleanupExpiredRooms() {
        try {
            const roomKeys = await this.redis.keys('private_room:*');
            const now = Date.now();
            for (const key of roomKeys) {
                const roomJson = await this.redis.get(key);
                if (!roomJson)
                    continue;
                const room = JSON.parse(roomJson);
                if (new Date(room.expiresAt).getTime() < now) {
                    await this.redis.del(key);
                    console.log(`Cleaned up expired private room: ${room.roomCode}`);
                }
            }
        }
        catch (error) {
            console.error('Error cleaning up expired rooms:', error);
        }
    }
}
exports.SocialLayerService = SocialLayerService;
//# sourceMappingURL=socialLayerService.js.map