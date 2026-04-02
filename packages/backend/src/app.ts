import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cluster from 'cluster';
import os from 'os';

import authRoutes from './routes/auth.routes';
import battleRoutes from './routes/battle.routes';
import problemRoutes from './routes/problem.routes';
import spellRoutes from './routes/spell.routes';
import leaderboardRoutes from './routes/leaderboard.routes';

import { cronService } from './services/cron.service';
import { socketRedisAdapterService } from './services/socket-redis-adapter.service';
import { authMiddleware } from './middleware/auth.middleware';
import { validateRateLimit } from './middleware/validation.middleware';
import { requestLogger, logger } from './utils/logger';
import DatabaseIndexManager from './models/indexes';

import { ConnectionManager } from './socket/connection.manager';
import { matchmakingService } from './services/matchmaking.service';
import { battleRoomService } from './services/battle-room.service';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes (placeholder for future REST API)
app.get('/api/stats', async (req, res) => {
  try {
    const matchmakingStats = await matchmakingService.getMatchmakingStats();
    res.json({
      matchmaking: matchmakingStats,
      connectedUsers: io.sockets.sockets.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Register API routes
app.use('/api/auth', authRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/spells', spellRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Initialize connection manager
const connectionManager = new ConnectionManager(io);

// Socket.io connection handling
io.on('connection', (socket) => {
  connectionManager.handleConnection(socket);
});

// Setup periodic tasks
connectionManager.setupPeriodicCleanup();
// matchmakingService scan starts automatically in its constructor

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Starting graceful shutdown...');
  
  // Stop matchmaking
  matchmakingService.stopMatchmakingScan();
  
  // Cleanup battle rooms
  await battleRoomService.cleanup();
  
  // Shutdown connection manager
  await connectionManager.shutdown();
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.log('Forcing shutdown');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Code-Clash server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Socket.io server ready`);
  console.log(`🏆 Matchmaking service started`);
  
  // Start cron jobs
  cronService.startAllJobs();
  console.log(`⏰ Cron jobs initialized`);
});
