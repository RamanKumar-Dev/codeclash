import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

import authRoutes from './routes/auth';
import matchRoutes from './routes/match';
import leaderboardRoutes from './routes/leaderboard';
import problemRoutes from './routes/problem';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketHandlers, cleanupSocketServices } from './services/socketService';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const server = createServer(app);

// Initialize Redis for Socket.io adapter
const pubClient: RedisClientType = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const subClient: RedisClientType = pubClient.duplicate();

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  adapter: createAdapter(pubClient, subClient)
});

export const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/match', authenticateToken, matchRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/problems', problemRoutes);

// Error handling
app.use(errorHandler);

// Socket.io setup
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Code-Clash API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down gracefully...');
  await cleanupSocketServices();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Shutting down gracefully...');
  await cleanupSocketServices();
  await prisma.$disconnect();
  process.exit(0);
});
