import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient, RedisClientType } from 'redis';
import cors from 'cors';
import dotenv from 'dotenv';

import { AuthMiddleware } from './middleware/auth';
import { MatchmakingService } from './services/matchmaking';
import { BattleService } from './services/battle';
import { UserService } from './services/userService';
import { ProblemService } from './services/problemService';

dotenv.config();

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Redis client
const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Services
const matchmakingService = new MatchmakingService(io, redis);
const battleService = new BattleService(io, redis);

// User socket mapping (MVP - in production, use Redis)
const userSockets = new Map<string, string>();

// REST Routes
app.get('/', (req, res) => {
  res.json({
    message: '🎯 Code-Clash Arena API - MVP Ready!',
    apiStatus: 'operational',
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
    systemStatus: 'All systems operational'
  });
});

app.post('/auth/register', AuthMiddleware.rateLimiter, AuthMiddleware.register);
app.post('/auth/login', AuthMiddleware.rateLimiter, AuthMiddleware.login);
app.get('/profile/me', AuthMiddleware.authenticate, (req, res) => {
  res.json({ user: (req as any).user });
});

app.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const leaderboard = await UserService.getLeaderboard(limit);
    
    // Add rank to each user
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      ...user,
      winRate: user.wins + user.losses > 0 
        ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
        : '0.0'
    }));
    
    res.json(rankedLeaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// API Routes
app.get('/api/problems/random', async (req, res) => {
  try {
    const problem = await ProblemService.getRandomProblem();
    if (!problem) {
      return res.status(404).json({ error: 'No problems available' });
    }
    res.json(problem);
  } catch (error) {
    console.error('Random problem error:', error);
    res.status(500).json({ error: 'Failed to fetch problem' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Store user mapping when authenticated
  socket.on('authenticate', async (data: { token: string }) => {
    try {
      const payload = AuthMiddleware.verifyToken(data.token);
      userSockets.set(payload.userId, socket.id);
      (socket as any).userId = payload.userId;
      (socket as any).username = payload.username;
      
      console.log(`User ${payload.username} authenticated`);
      socket.emit('authenticated', { userId: payload.userId, username: payload.username });
    } catch (error) {
      socket.emit('error', 'Invalid token');
    }
  });

  // Queue events
  socket.on('queue:join', async (data: { userId: string }) => {
    const userId = data.userId || (socket as any).userId;
    if (!userId) {
      socket.emit('error', 'User ID required');
      return;
    }

    await matchmakingService.addToQueue(userId);
    socket.emit('queue:joined', { queueSize: 2 }); // Mock queue size
  });

  socket.on('queue:leave', async () => {
    const userId = (socket as any).userId;
    if (!userId) return;

    await matchmakingService.removeFromQueue(userId);
  });

  // Battle events
  socket.on('battle:submit', async (data) => {
    const userId = (socket as any).userId;
    if (!userId) {
      socket.emit('error', 'User not authenticated');
      return;
    }

    await battleService.handleSubmit(socket, data);
  });

  socket.on('battle:forfeit', async (data) => {
    const userId = (socket as any).userId;
    if (!userId) {
      socket.emit('error', 'User not authenticated');
      return;
    }

    await battleService.handleForfeit(socket, data);
  });

  // Handle match found response to start countdown
  socket.on('battle:ready', async (data: { roomId: string }) => {
    await battleService.startCountdown(data.roomId);
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const userId = (socket as any).userId;
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
