"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const redis_1 = require("redis");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./middleware/auth");
const matchmaking_1 = require("./services/matchmaking");
const battle_1 = require("./services/battle");
const userService_1 = require("./services/userService");
const problemService_1 = require("./services/problemService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static('public'));
// Redis client
const redis = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
// Socket.io setup
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});
// Services
const matchmakingService = new matchmaking_1.MatchmakingService(io, redis);
const battleService = new battle_1.BattleService(io, redis);
// User socket mapping (MVP - in production, use Redis)
const userSockets = new Map();
// REST Routes
app.get('/', (req, res) => {
    res.json({
        message: '🎯 Code-Clash Arena API - MVP Ready!',
        status: 'operational',
        endpoints: {
            auth: {
                register: 'POST /auth/register',
                login: 'POST /auth/login',
                profile: 'GET /profile/me (requires JWT)'
            },
            game: {
                leaderboard: 'GET /leaderboard',
                problems: 'GET /api/problems/random'
            },
            socket: {
                connect: 'WebSocket connection for real-time battles',
                events: ['join-queue', 'leave-queue', 'submit-code']
            }
        },
        database: 'PostgreSQL + Prisma',
        cache: 'Redis',
        status: 'All systems operational'
    });
});
app.post('/auth/register', auth_1.AuthMiddleware.rateLimiter, auth_1.AuthMiddleware.register);
app.post('/auth/login', auth_1.AuthMiddleware.rateLimiter, auth_1.AuthMiddleware.login);
app.get('/profile/me', auth_1.AuthMiddleware.authenticate, (req, res) => {
    res.json({ user: req.user });
});
app.get('/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const leaderboard = await userService_1.UserService.getLeaderboard(limit);
        // Add rank to each user
        const rankedLeaderboard = leaderboard.map((user, index) => ({
            rank: index + 1,
            ...user,
            winRate: user.wins + user.losses > 0
                ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
                : '0.0'
        }));
        res.json(rankedLeaderboard);
    }
    catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});
// API Routes
app.get('/api/problems/random', async (req, res) => {
    try {
        const problem = await problemService_1.ProblemService.getRandomProblem();
        if (!problem) {
            return res.status(404).json({ error: 'No problems available' });
        }
        res.json(problem);
    }
    catch (error) {
        console.error('Random problem error:', error);
        res.status(500).json({ error: 'Failed to fetch problem' });
    }
});
// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    // Store user mapping when authenticated
    socket.on('authenticate', async (data) => {
        try {
            const payload = auth_1.AuthMiddleware.verifyToken(data.token);
            userSockets.set(payload.userId, socket.id);
            socket.userId = payload.userId;
            socket.username = payload.username;
            console.log(`User ${payload.username} authenticated`);
            socket.emit('authenticated', { userId: payload.userId, username: payload.username });
        }
        catch (error) {
            socket.emit('error', 'Invalid token');
        }
    });
    // Queue events
    socket.on('queue:join', async (data) => {
        const userId = data.userId || socket.userId;
        if (!userId) {
            socket.emit('error', 'User ID required');
            return;
        }
        await matchmakingService.addToQueue(userId);
        socket.emit('queue:joined', { queueSize: 2 }); // Mock queue size
    });
    socket.on('queue:leave', async () => {
        const userId = socket.userId;
        if (!userId)
            return;
        await matchmakingService.removeFromQueue(userId);
    });
    // Battle events
    socket.on('battle:submit', async (data) => {
        const userId = socket.userId;
        if (!userId) {
            socket.emit('error', 'User not authenticated');
            return;
        }
        await battleService.handleSubmit(socket, data);
    });
    socket.on('battle:forfeit', async (data) => {
        const userId = socket.userId;
        if (!userId) {
            socket.emit('error', 'User not authenticated');
            return;
        }
        await battleService.handleForfeit(socket, data);
    });
    // Handle match found response to start countdown
    socket.on('battle:ready', async (data) => {
        await battleService.startCountdown(data.roomId);
    });
    // Disconnect handling
    socket.on('disconnect', () => {
        const userId = socket.userId;
        if (userId) {
            userSockets.delete(userId);
            matchmakingService.removeFromQueue(userId);
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});
// Start server
const PORT = process.env.PORT || 3001;
async function startServer() {
    try {
        // Connect to Redis
        await redis.connect();
        console.log('Connected to Redis');
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map