import pino from 'pino';
import { createWriteStream } from 'pino-sentry';

// Base logger configuration
const baseConfig = {
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive information
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.secret',
    ],
    censor: '***',
  },
};

// Create logger instance
const logger = pino(baseConfig);

// Add Sentry transport if SENTRY_DSN is provided
if (process.env.SENTRY_DSN) {
  const sentryTransport = createWriteStream({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    serviceName: 'code-clash-api',
  });
  
  logger.add(sentryTransport);
}

// Development logger with pretty printing
const developmentLogger = pino({
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
});

// Production logger with structured JSON
const productionLogger = logger;

// Choose appropriate logger based on environment
const appLogger = process.env.NODE_ENV === 'production' ? productionLogger : developmentLogger;

// Request logger middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  // Generate request ID
  req.id = Math.random().toString(36).substr(2, 9);
  
  // Log request start
  appLogger.info({
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  }, 'Request started');

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    appLogger.info({
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      timestamp: new Date().toISOString(),
    }, 'Request completed');
  });

  next();
};

// Error logger
export const errorLogger = (error: any, req: any, res: any, next: any) => {
  appLogger.error({
    requestId: req.id,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  }, 'Request error');

  next(error);
};

// Battle event logger
export const battleLogger = (event: string, data: any) => {
  appLogger.info({
    event,
    data,
    timestamp: new Date().toISOString(),
  }, 'Battle event');
};

// Judge service logger
export const judgeLogger = (event: string, data: any) => {
  appLogger.info({
    event,
    data,
    timestamp: new Date().toISOString(),
  }, 'Judge event');
};

// Security event logger
export const securityLogger = (event: string, data: any) => {
  appLogger.warn({
    event,
    data,
    timestamp: new Date().toISOString(),
  }, 'Security event');
};

// Performance logger
export const performanceLogger = (operation: string, duration: number, metadata?: any) => {
  appLogger.info({
    operation,
    duration: `${duration}ms`,
    metadata,
    timestamp: new Date().toISOString(),
  }, 'Performance metric');
};

// Database query logger
export const dbLogger = (query: string, duration: number, metadata?: any) => {
  appLogger.debug({
    query,
    duration: `${duration}ms`,
    metadata,
    timestamp: new Date().toISOString(),
  }, 'Database query');
};

// Cache logger
export const cacheLogger = (operation: string, key: string, hit?: boolean, duration?: number) => {
  appLogger.debug({
    operation,
    key,
    hit,
    duration: duration ? `${duration}ms` : undefined,
    timestamp: new Date().toISOString(),
  }, 'Cache operation');
};

// WebSocket event logger
export const wsLogger = (event: string, socketId: string, data?: any) => {
  appLogger.info({
    event,
    socketId,
    data,
    timestamp: new Date().toISOString(),
  }, 'WebSocket event');
};

// Health check logger
export const healthLogger = (service: string, status: string, details?: any) => {
  const level = status === 'healthy' ? 'info' : 'warn';
  
  appLogger[level]({
    service,
    status,
    details,
    timestamp: new Date().toISOString(),
  }, 'Health check');
};

// Metrics collector
export class MetricsCollector {
  private metrics = new Map<string, number>();

  increment(metric: string, value: number = 1): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  timing(metric: string, duration: number): void {
    this.metrics.set(`${metric}_duration`, duration);
  }

  gauge(metric: string, value: number): void {
    this.metrics.set(metric, value);
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  reset(): void {
    this.metrics.clear();
  }

  // Log metrics periodically
  startLogging(interval: number = 60000): void { // 1 minute default
    setInterval(() => {
      const metrics = this.getMetrics();
      if (Object.keys(metrics).length > 0) {
        appLogger.info({
          metrics,
          timestamp: new Date().toISOString(),
        }, 'Application metrics');
        this.reset();
      }
    }, interval);
  }
}

// Global metrics collector
export const metrics = new MetricsCollector();

// Performance monitoring decorator
export function performanceMonitor(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    try {
      const result = await method.apply(this, args);
      const duration = Date.now() - start;
      
      performanceLogger(`${target.constructor.name}.${propertyName}`, duration, {
        args: args.length,
        success: true,
      });
      
      metrics.timing(`${target.constructor.name}.${propertyName}`, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      performanceLogger(`${target.constructor.name}.${propertyName}`, duration, {
        args: args.length,
        success: false,
        error: error.message,
      });
      
      metrics.timing(`${target.constructor.name}.${propertyName}_error`, duration);
      
      throw error;
    }
  };

  return descriptor;
}

// Export the main logger
export default appLogger;
