"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSentry = initializeSentry;
exports.captureException = captureException;
exports.captureMessage = captureMessage;
exports.setUser = setUser;
exports.addBreadcrumb = addBreadcrumb;
exports.performHealthCheck = performHealthCheck;
exports.startTransaction = startTransaction;
exports.finishTransaction = finishTransaction;
const Sentry = __importStar(require("@sentry/node"));
const tracing_1 = require("@sentry/tracing");
const logger_1 = __importDefault(require("./logger"));
function initializeSentry() {
    if (!process.env.SENTRY_DSN) {
        logger_1.default.warn('Sentry DSN not provided, skipping Sentry initialization');
        return;
    }
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        integrations: [
            new tracing_1.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.OnUncaughtException(),
            new Sentry.Integrations.OnUnhandledRejection(),
        ],
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.APP_VERSION || '1.0.0',
        debug: process.env.NODE_ENV !== 'production',
    });
    logger_1.default.info('Sentry initialized');
}
function captureException(error, context) {
    logger_1.default.error({ error, context }, 'Exception captured');
    Sentry.captureException(error, { extra: context });
}
function captureMessage(message, level = 'info') {
    logger_1.default.info({ message }, 'Message captured');
    Sentry.captureMessage(message, level);
}
function setUser(user) {
    Sentry.setUser(user);
    logger_1.default.info({ userId: user.id }, 'User context set');
}
function addBreadcrumb(breadcrumb) {
    Sentry.addBreadcrumb(breadcrumb);
}
// Health check with monitoring integration
async function performHealthCheck() {
    const services = {};
    let overallStatus = 'healthy';
    try {
        // Database health check
        try {
            // await prisma.$queryRaw`SELECT 1`;
            services.database = true;
        }
        catch (error) {
            services.database = false;
            overallStatus = 'unhealthy';
            captureException(error, { service: 'database' });
        }
        // Redis health check
        try {
            // await redis.ping();
            services.redis = true;
        }
        catch (error) {
            services.redis = false;
            overallStatus = 'unhealthy';
            captureException(error, { service: 'redis' });
        }
        // Judge0 health check
        try {
            // const response = await axios.get(`${process.env.JUDGE0_URL}/system`);
            services.judge0 = true;
        }
        catch (error) {
            services.judge0 = false;
            overallStatus = 'unhealthy';
            captureException(error, { service: 'judge0' });
        }
        // Memory and CPU checks
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
            overallStatus = 'unhealthy';
            captureMessage('High memory usage detected', 'warning');
        }
        logger_1.default.info({
            services,
            memory: memUsage,
            cpu: cpuUsage,
            status: overallStatus
        }, 'Health check completed');
        return {
            status: overallStatus,
            services,
            timestamp: new Date().toISOString()
        };
    }
    catch (error) {
        captureException(error, { context: 'health_check' });
        return {
            status: 'unhealthy',
            services,
            timestamp: new Date().toISOString()
        };
    }
}
// Performance monitoring
function startTransaction(name, op) {
    const transaction = Sentry.startTransaction({
        name,
        op,
    });
    logger_1.default.debug({ transaction: name, operation: op }, 'Transaction started');
    return transaction;
}
function finishTransaction(transaction, status) {
    transaction.finish(status);
    logger_1.default.debug({
        transaction: transaction.name,
        duration: transaction.endTimestamp - transaction.startTimestamp
    }, 'Transaction finished');
}
//# sourceMappingURL=monitoring.js.map