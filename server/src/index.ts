import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createClient, RedisClientType } from 'redis';
import cors from 'cors';
import dotenv from 'dotenv';

import { AuthMiddleware } from './middleware/auth';
import { MatchmakingService } from './services/matchmaking';
import { BattleService } from './services/battle';
import { SpellService } from './services/spellService';
import { UserService } from './services/userService';
import { AchievementService } from './services/achievementService';
import { ProblemService } from './services/problemService';

dotenv.config();

const app = express();
const server = createServer(app);

// Middleware
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());
app.use(express.static('public'));

// Redis client
const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:5173',
      'http://localhost:4173',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── Socket Registry (THE FIX) ──────────────────────────────────────────────
// Maps userId → Socket. This was the critical missing piece — matchmaking
// couldn't notify players because getUserSocket always returned null.
const socketRegistry = new Map<string, Socket>();

// Services
const matchmakingService = new MatchmakingService(io, redis, socketRegistry);
const battleService = new BattleService(io, redis, socketRegistry);
const spellService = new SpellService(redis);

// ─── REST Routes ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    message: '⚔️ CodeClash Arena API',
    version: '2.0.0',
    status: 'operational',
    endpoints: {
      auth: { register: 'POST /auth/register', login: 'POST /auth/login' },
      profile: { me: 'GET /profile/me', achievements: 'GET /profile/achievements' },
      game: { leaderboard: 'GET /leaderboard', problems: 'GET /api/problems' },
      spells: 'GET /api/spells',
    },
  });
});

// Auth
app.post('/auth/register', AuthMiddleware.rateLimiter, AuthMiddleware.register);
app.post('/auth/login', AuthMiddleware.rateLimiter, AuthMiddleware.login);

// Profile
app.get('/profile/me', AuthMiddleware.authenticate, async (req, res) => {
  try {
    const user = await UserService.getUserById((req as any).user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.get('/profile/achievements', AuthMiddleware.authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const [earned, definitions] = await Promise.all([
      AchievementService.getUserAchievements(userId),
      Promise.resolve(AchievementService.getAllDefinitions()),
    ]);
    res.json({ earned, definitions });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Leaderboard
app.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const leaderboard = await UserService.getLeaderboard(limit);
    const ranked = leaderboard.map((user, index) => ({
      rank: index + 1,
      ...user,
      winRate: user.wins + user.losses > 0
        ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
        : '0.0',
      tier: getEloTier(user.elo),
    }));
    res.json(ranked);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Problems
app.get('/api/problems', async (req, res) => {
  try {
    const problems = await ProblemService.getAllProblems();
    res.json(problems);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

app.get('/api/problems/random', async (req, res) => {
  try {
    const problem = await ProblemService.getRandomProblem();
    if (!problem) return res.status(404).json({ error: 'No problems available' });
    res.json(problem);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch problem' });
  }
});

// Spell info
app.get('/api/spells', (_req, res) => {
  res.json(SpellService.getSpellInfo());
});

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // ── Authentication ──────────────────────────────────────────────────────────
  socket.on('authenticate', async (data: { token: string }) => {
    try {
      const payload = AuthMiddleware.verifyToken(data.token);
      (socket as any).userId = payload.userId;
      (socket as any).username = payload.username;
      (socket as any).elo = payload.elo || 1000;

      // Register socket
      socketRegistry.set(payload.userId, socket);

      console.log(`[Auth] ${payload.username} authenticated (ELO: ${(socket as any).elo})`);
      socket.emit('authenticated', { userId: payload.userId, username: payload.username });
    } catch {
      socket.emit('auth:error', 'Invalid token');
    }
  });

  // ── Queue ───────────────────────────────────────────────────────────────────
  socket.on('queue:join', async (data?: { userId?: string; elo?: number }) => {
    const userId = (socket as any).userId || data?.userId;
    if (!userId) {
      socket.emit('queue:error', 'Authenticate first');
      return;
    }

    const elo = (socket as any).elo || data?.elo || 1000;
    await matchmakingService.addToQueue(userId, elo);
    socket.emit('queue:joined', { message: 'Entered matchmaking queue' });
  });

  socket.on('queue:leave', async () => {
    const userId = (socket as any).userId;
    if (userId) await matchmakingService.removeFromQueue(userId);
  });

  // ── Battle ──────────────────────────────────────────────────────────────────
  socket.on('battle:submit', async (data: { code: string; languageId: number; roomId: string }) => {
    const userId = (socket as any).userId;
    if (!userId) { socket.emit('error', 'Not authenticated'); return; }
    await battleService.handleSubmit(socket, { ...data, userId });
  });

  socket.on('battle:forfeit', async (data: { roomId: string }) => {
    const userId = (socket as any).userId;
    if (!userId) { socket.emit('error', 'Not authenticated'); return; }
    await battleService.handleForfeit(socket, { ...data, userId });
  });

  socket.on('battle:ready', async (data: { roomId: string }) => {
    await battleService.startCountdown(data.roomId);
  });

  // ── Spells ──────────────────────────────────────────────────────────────────
  socket.on('spell:cast', async (data: {
    roomId: string;
    spellType: 'hint' | 'time_freeze' | 'slow';
  }) => {
    const casterId = (socket as any).userId;
    if (!casterId) { socket.emit('error', 'Not authenticated'); return; }

    try {
      const battleState = await battleService.getBattleStatePublic(data.roomId);
      if (!battleState) { socket.emit('spell:error', 'Battle not found'); return; }

      const targetId = battleState.player1Id === casterId
        ? battleState.player2Id
        : battleState.player1Id;

      const testCases = await battleService.getPuzzleTestCases(data.roomId);
      const result = await spellService.castSpell(
        data.roomId, casterId, targetId, data.spellType, testCases
      );

      if (!result.success) {
        socket.emit('spell:error', result.error);
        return;
      }

      // Notify caster of mana update
      const mana = await spellService.getMana(data.roomId, casterId);
      socket.emit('spell:cast_success', {
        spellType: data.spellType,
        mana: mana.current,
        hintText: result.hintText,
      });

      // Notify caster of hint (private)
      if (data.spellType === 'hint' && result.hintText) {
        socket.emit('spell:hint', { text: result.hintText });
      }

      // Notify opponent of incoming spell effect
      const targetSocket = socketRegistry.get(targetId);
      if (targetSocket) {
        targetSocket.emit('spell:incoming', {
          spellType: data.spellType,
          casterName: (socket as any).username,
          duration: data.spellType === 'time_freeze' ? 15000 : data.spellType === 'slow' ? 10000 : 0,
        });
      }

      // Broadcast spell animation to room
      io.to(data.roomId).emit('spell:animation', {
        spellType: data.spellType,
        casterName: (socket as any).username,
      });

      // Track spell cast for achievements
      await UserService.incrementSpellsCast(casterId);

    } catch (e) {
      console.error('[Spell] Error:', e);
      socket.emit('spell:error', 'Spell failed');
    }
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const userId = (socket as any).userId;
    if (userId) {
      socketRegistry.delete(userId);
      matchmakingService.removeFromQueue(userId);
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getEloTier(elo: number): string {
  if (elo >= 2000) return 'Diamond';
  if (elo >= 1700) return 'Platinum';
  if (elo >= 1400) return 'Gold';
  if (elo >= 1200) return 'Silver';
  return 'Bronze';
}

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis');

    server.listen(PORT, () => {
      console.log(`🚀 CodeClash server running on port ${PORT}`);
      console.log(`   Socket.io: ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
