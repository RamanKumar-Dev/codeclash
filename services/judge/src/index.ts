import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createClient, RedisClientType } from 'redis';
import { PrismaClient } from '@prisma/client';

import { ExecutionService } from './services/executionService';
import { createExecutionRoutes } from './routes/execution';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize Prisma
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Initialize Redis
const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3001",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'judge',
    timestamp: new Date().toISOString() 
  });
});

// Initialize services
let executionService: ExecutionService;

async function initializeServices() {
  try {
    // Connect to Redis
    await redis.connect();
    console.log('✅ Connected to Redis');

    // Initialize execution service
    executionService = new ExecutionService(prisma, redis);
    console.log('✅ Execution service initialized');

    // Setup routes
    app.use('/api', createExecutionRoutes(executionService));
    console.log('✅ Routes configured');

  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  await initializeServices();

  app.listen(PORT, () => {
    console.log(`🚀 Judge service running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 API endpoints: http://localhost:${PORT}/api`);
  });
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('🔄 Shutting down gracefully...');
  
  try {
    await prisma.$disconnect();
    await redis.quit();
    console.log('✅ Disconnected from databases');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
}

// Handle process signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Start the server
startServer();
