"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
exports.getMatchmakingService = getMatchmakingService;
exports.getBattleService = getBattleService;
exports.cleanupSocketServices = cleanupSocketServices;
const redis_1 = require("redis");
const client_1 = require("@prisma/client");
const matchmakingService_1 = require("./matchmakingService");
const battleService_1 = require("./battleService");
const validation_1 = require("../utils/validation");
let matchmakingService = null;
let battleService = null;
let redis = null;
async function setupSocketHandlers(io) {
    // Initialize Redis connection
    redis = (0, redis_1.createClient)({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redis.connect();
    console.log('Connected to Redis for Socket.io services');
    // Initialize services
    const prisma = new client_1.PrismaClient();
    matchmakingService = new matchmakingService_1.MatchmakingService(redis, prisma, io);
    battleService = new battleService_1.BattleService(redis, prisma, io);
    // Start matchmaking service
    await matchmakingService.startMatchmaking();
    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }
            // Verify JWT token
            const decoded = (0, validation_1.verifyJWT)(token);
            socket.userId = decoded.userId;
            socket.username = decoded.username;
            socket.elo = decoded.elo;
            next();
        }
        catch (error) {
            console.error('Socket authentication error:', error);
            next(new Error('Authentication error: Invalid token'));
        }
    });
    // Connection handler
    io.on('connection', async (socket) => {
        const userId = socket.userId;
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
        socket.on('queue:join', async (data) => {
            try {
                const validatedData = (0, validation_1.validateInput)(validation_1.QueueJoinSchema, data);
                const { elo } = validatedData;
                console.log(`User ${userId} joining matchmaking queue with ELO ${elo}`);
                if (matchmakingService) {
                    await matchmakingService.addToQueue(userId, socket.id, elo);
                    const queueSize = await matchmakingService.getQueueSize();
                    socket.emit('queue:joined', { queueSize });
                    io.emit('queue:size_update', { size: queueSize });
                }
            }
            catch (error) {
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
            }
            catch (error) {
                console.error('Error leaving queue:', error);
                socket.emit('error', { message: 'Failed to leave queue' });
            }
        });
        // Battle events
        socket.on('battle:submit', async (data) => {
            try {
                const validatedData = (0, validation_1.validateInput)(validation_1.BattleSubmitSchema, data);
                if (battleService) {
                    await battleService.handleSubmission(socket, validatedData);
                }
            }
            catch (error) {
                console.error('Error in battle submit:', error);
                socket.emit('error', { message: 'Failed to submit code' });
            }
        });
        socket.on('battle:spell_cast', async (data) => {
            try {
                const validatedData = (0, validation_1.validateInput)(validation_1.SpellCastSchema, data);
                if (battleService) {
                    await battleService.handleSpellCast(socket, validatedData);
                }
            }
            catch (error) {
                console.error('Error in spell cast:', error);
                socket.emit('error', { message: 'Failed to cast spell' });
            }
        });
        socket.on('battle:forfeit', async (data) => {
            try {
                if (battleService) {
                    await battleService.handleForfeit(socket, data);
                }
            }
            catch (error) {
                console.error('Error in forfeit:', error);
                socket.emit('error', { message: 'Failed to forfeit' });
            }
        });
        socket.on('battle:ready', async (data) => {
            try {
                const validatedData = (0, validation_1.validateInput)(validation_1.BattleReadySchema, data);
                const { roomId } = validatedData;
                console.log(`User ${userId} ready for battle in room ${roomId}`);
                socket.join(roomId);
                // Check if both players are ready, then start countdown
                const roomSockets = await io.in(roomId).fetchSockets();
                if (roomSockets.length === 2 && battleService) {
                    await battleService.startBattleCountdown(roomId);
                }
            }
            catch (error) {
                console.error('Error handling battle ready:', error);
                socket.emit('error', { message: 'Failed to ready up for battle' });
            }
        });
        // Room management
        socket.on('join_room', async (data) => {
            try {
                const validatedData = (0, validation_1.validateInput)(validation_1.JoinRoomSchema, data);
                const { roomId } = validatedData;
                socket.join(roomId);
                console.log(`User ${userId} joined room ${roomId}`);
            }
            catch (error) {
                console.error('Error joining room:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });
        socket.on('leave_room', async (data) => {
            try {
                const validatedData = (0, validation_1.validateInput)(validation_1.JoinRoomSchema, data);
                const { roomId } = validatedData;
                socket.leave(roomId);
                console.log(`User ${userId} left room ${roomId}`);
            }
            catch (error) {
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
            }
            catch (error) {
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
function getMatchmakingService() {
    return matchmakingService;
}
function getBattleService() {
    return battleService;
}
// Cleanup function
async function cleanupSocketServices() {
    if (matchmakingService) {
        await matchmakingService.stopMatchmaking();
    }
    if (redis) {
        await redis.quit();
    }
    console.log('Socket.io services cleaned up');
}
//# sourceMappingURL=socketService.js.map