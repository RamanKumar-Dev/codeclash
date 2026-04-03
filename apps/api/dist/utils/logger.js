"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = exports.MetricsCollector = exports.healthLogger = exports.wsLogger = exports.cacheLogger = exports.dbLogger = exports.performanceLogger = exports.securityLogger = exports.judgeLogger = exports.battleLogger = exports.errorLogger = exports.requestLogger = void 0;
exports.performanceMonitor = performanceMonitor;
const pino_1 = __importDefault(require("pino"));
const pino_sentry_1 = require("pino-sentry");
// Base logger configuration
const baseConfig = {
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
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
const logger = (0, pino_1.default)(baseConfig);
// Add Sentry transport if SENTRY_DSN is provided
if (process.env.SENTRY_DSN) {
    const sentryTransport = (0, pino_sentry_1.createWriteStream)({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        serviceName: 'code-clash-api',
    });
    logger.add(sentryTransport);
}
// Development logger with pretty printing
const developmentLogger = (0, pino_1.default)({
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
const requestLogger = (req, res, next) => {
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
exports.requestLogger = requestLogger;
// Error logger
const errorLogger = (error, req, res, next) => {
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
exports.errorLogger = errorLogger;
// Battle event logger
const battleLogger = (event, data) => {
    appLogger.info({
        event,
        data,
        timestamp: new Date().toISOString(),
    }, 'Battle event');
};
exports.battleLogger = battleLogger;
// Judge service logger
const judgeLogger = (event, data) => {
    appLogger.info({
        event,
        data,
        timestamp: new Date().toISOString(),
    }, 'Judge event');
};
exports.judgeLogger = judgeLogger;
// Security event logger
const securityLogger = (event, data) => {
    appLogger.warn({
        event,
        data,
        timestamp: new Date().toISOString(),
    }, 'Security event');
};
exports.securityLogger = securityLogger;
// Performance logger
const performanceLogger = (operation, duration, metadata) => {
    appLogger.info({
        operation,
        duration: `${duration}ms`,
        metadata,
        timestamp: new Date().toISOString(),
    }, 'Performance metric');
};
exports.performanceLogger = performanceLogger;
// Database query logger
const dbLogger = (query, duration, metadata) => {
    appLogger.debug({
        query,
        duration: `${duration}ms`,
        metadata,
        timestamp: new Date().toISOString(),
    }, 'Database query');
};
exports.dbLogger = dbLogger;
// Cache logger
const cacheLogger = (operation, key, hit, duration) => {
    appLogger.debug({
        operation,
        key,
        hit,
        duration: duration ? `${duration}ms` : undefined,
        timestamp: new Date().toISOString(),
    }, 'Cache operation');
};
exports.cacheLogger = cacheLogger;
// WebSocket event logger
const wsLogger = (event, socketId, data) => {
    appLogger.info({
        event,
        socketId,
        data,
        timestamp: new Date().toISOString(),
    }, 'WebSocket event');
};
exports.wsLogger = wsLogger;
// Health check logger
const healthLogger = (service, status, details) => {
    const level = status === 'healthy' ? 'info' : 'warn';
    appLogger[level]({
        service,
        status,
        details,
        timestamp: new Date().toISOString(),
    }, 'Health check');
};
exports.healthLogger = healthLogger;
// Metrics collector
class MetricsCollector {
    constructor() {
        this.metrics = new Map();
    }
    increment(metric, value = 1) {
        const current = this.metrics.get(metric) || 0;
        this.metrics.set(metric, current + value);
    }
    timing(metric, duration) {
        this.metrics.set(`${metric}_duration`, duration);
    }
    gauge(metric, value) {
        this.metrics.set(metric, value);
    }
    getMetrics() {
        return Object.fromEntries(this.metrics);
    }
    reset() {
        this.metrics.clear();
    }
    // Log metrics periodically
    startLogging(interval = 60000) {
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
exports.MetricsCollector = MetricsCollector;
// Global metrics collector
exports.metrics = new MetricsCollector();
// Performance monitoring decorator
function performanceMonitor(target, propertyName, descriptor) {
    const method = descriptor.value;
    descriptor.value = async function (...args) {
        const start = Date.now();
        try {
            const result = await method.apply(this, args);
            const duration = Date.now() - start;
            (0, exports.performanceLogger)(`${target.constructor.name}.${propertyName}`, duration, {
                args: args.length,
                success: true,
            });
            exports.metrics.timing(`${target.constructor.name}.${propertyName}`, duration);
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            (0, exports.performanceLogger)(`${target.constructor.name}.${propertyName}`, duration, {
                args: args.length,
                success: false,
                error: error.message,
            });
            exports.metrics.timing(`${target.constructor.name}.${propertyName}_error`, duration);
            throw error;
        }
    };
    return descriptor;
}
// Export the main logger
exports.default = appLogger;
//# sourceMappingURL=logger.js.map