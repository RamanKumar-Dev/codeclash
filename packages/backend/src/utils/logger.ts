import pino from 'pino';

// Logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  }
};

// Create base logger
const baseLogger = pino(loggerConfig);

// Enhanced logger with additional context
export const logger = baseLogger.child({
  service: 'code-clash-backend',
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development'
});

// Request logger middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id
    }, 'HTTP Request');
  });

  next();
};

// Socket logger
export const socketLogger = (event: string, data: any, socketId?: string, userId?: string) => {
  logger.info({
    event,
    socketId,
    userId,
    data: typeof data === 'object' ? JSON.stringify(data).substring(0, 200) : data
  }, 'Socket Event');
};

// Error logger
export const logError = (error: Error, context?: any) => {
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context
  }, 'Application Error');
};

// Performance logger
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info({
    operation,
    duration: `${duration}ms`,
    metadata
  }, 'Performance Metric');
};

// Security logger
export const logSecurity = (event: string, details: any) => {
  logger.warn({
    securityEvent: event,
    details,
    timestamp: new Date().toISOString()
  }, 'Security Event');
};

// Database logger
export const logDatabase = (operation: string, collection: string, duration?: number, metadata?: any) => {
  logger.info({
    databaseOperation: operation,
    collection,
    duration: duration ? `${duration}ms` : undefined,
    metadata
  }, 'Database Operation');
};

// Redis logger
export const logRedis = (operation: string, key: string, duration?: number, metadata?: any) => {
  logger.debug({
    redisOperation: operation,
    key,
    duration: duration ? `${duration}ms` : undefined,
    metadata
  }, 'Redis Operation');
};

// Judge service logger
export const logJudge = (operation: string, submissionId?: string, language?: string, metadata?: any) => {
  logger.info({
    judgeOperation: operation,
    submissionId,
    language,
    metadata
  }, 'Judge Service');
};

// Battle logger
export const logBattle = (event: string, roomId: string, userId?: string, metadata?: any) => {
  logger.info({
    battleEvent: event,
    roomId,
    userId,
    metadata
  }, 'Battle Event');
};

// Leaderboard logger
export const logLeaderboard = (operation: string, type: string, userId?: string, metadata?: any) => {
  logger.info({
    leaderboardOperation: operation,
    type,
    userId,
    metadata
  }, 'Leaderboard Operation');
};

// Season logger
export const logSeason = (event: string, seasonId?: string, metadata?: any) => {
  logger.info({
    seasonEvent: event,
    seasonId,
    metadata
  }, 'Season Event');
};

// Authentication logger
export const logAuth = (event: string, userId?: string, ip?: string, metadata?: any) => {
  logger.info({
    authEvent: event,
    userId,
    ip,
    metadata
  }, 'Authentication Event');
};

// Rate limiting logger
export const logRateLimit = (identifier: string, limit: number, remaining: number, resetTime: number) => {
  logger.warn({
    rateLimitEvent: 'limit_reached',
    identifier,
    limit,
    remaining,
    resetTime: new Date(resetTime).toISOString()
  }, 'Rate Limit');
};

// Health check logger
export const logHealth = (service: string, status: 'healthy' | 'unhealthy', responseTime?: number, details?: any) => {
  logger.info({
    healthCheck: service,
    status,
    responseTime: responseTime ? `${responseTime}ms` : undefined,
    details
  }, 'Health Check');
};

// Structured log levels
export const logLevels = {
  trace: (message: string, data?: any) => logger.trace({ data }, message),
  debug: (message: string, data?: any) => logger.debug({ data }, message),
  info: (message: string, data?: any) => logger.info({ data }, message),
  warn: (message: string, data?: any) => logger.warn({ data }, message),
  error: (message: string, error?: Error | any) => {
    if (error instanceof Error) {
      logger.error({ error: { message: error.message, stack: error.stack } }, message);
    } else {
      logger.error({ error }, message);
    }
  },
  fatal: (message: string, error?: Error | any) => {
    if (error instanceof Error) {
      logger.fatal({ error: { message: error.message, stack: error.stack } }, message);
    } else {
      logger.fatal({ error }, message);
    }
  }
};

// Performance monitoring
export class PerformanceMonitor {
  private static timers = new Map<string, number>();

  static start(label: string): void {
    this.timers.set(label, Date.now());
  }

  static end(label: string, metadata?: any): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      logger.warn({ label }, 'Performance timer not found');
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    logPerformance(label, duration, metadata);
    return duration;
  }

  static measure<T>(label: string, fn: () => T | Promise<T>, metadata?: any): T | Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.then(value => {
          const duration = Date.now() - startTime;
          logPerformance(label, duration, metadata);
          return value;
        }).catch(error => {
          const duration = Date.now() - startTime;
          logPerformance(label, duration, { ...metadata, error: error.message });
          throw error;
        });
      } else {
        const duration = Date.now() - startTime;
        logPerformance(label, duration, metadata);
        return result;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logPerformance(label, duration, { ...metadata, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }
}

// Export default logger for backward compatibility
export default logger;
