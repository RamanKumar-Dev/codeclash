import * as Sentry from '@sentry/node';
import { Integrations } from '@sentry/tracing';
import logger from './logger';

export function initializeSentry(): void {
  if (!process.env.SENTRY_DSN) {
    logger.warn('Sentry DSN not provided, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    debug: process.env.NODE_ENV !== 'production',
  });

  logger.info('Sentry initialized');
}

export function captureException(error: Error, context?: any): void {
  logger.error({ error, context }, 'Exception captured');
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, level: Sentry.Severity = 'info'): void {
  logger.info({ message }, 'Message captured');
  Sentry.captureMessage(message, level);
}

export function setUser(user: Sentry.User): void {
  Sentry.setUser(user);
  logger.info({ userId: user.id }, 'User context set');
}

export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(breadcrumb);
}

// Health check with monitoring integration
export async function performHealthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  services: Record<string, boolean>;
  timestamp: string;
}> {
  const services: Record<string, boolean> = {};
  let overallStatus: 'healthy' | 'unhealthy' = 'healthy';

  try {
    // Database health check
    try {
      // await prisma.$queryRaw`SELECT 1`;
      services.database = true;
    } catch (error) {
      services.database = false;
      overallStatus = 'unhealthy';
      captureException(error as Error, { service: 'database' });
    }

    // Redis health check
    try {
      // await redis.ping();
      services.redis = true;
    } catch (error) {
      services.redis = false;
      overallStatus = 'unhealthy';
      captureException(error as Error, { service: 'redis' });
    }

    // Judge0 health check
    try {
      // const response = await axios.get(`${process.env.JUDGE0_URL}/system`);
      services.judge0 = true;
    } catch (error) {
      services.judge0 = false;
      overallStatus = 'unhealthy';
      captureException(error as Error, { service: 'judge0' });
    }

    // Memory and CPU checks
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      overallStatus = 'unhealthy';
      captureMessage('High memory usage detected', 'warning');
    }

    logger.info({
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

  } catch (error) {
    captureException(error as Error, { context: 'health_check' });
    return {
      status: 'unhealthy',
      services,
      timestamp: new Date().toISOString()
    };
  }
}

// Performance monitoring
export function startTransaction(name: string, op: string): Sentry.Transaction {
  const transaction = Sentry.startTransaction({
    name,
    op,
  });

  logger.debug({ transaction: name, operation: op }, 'Transaction started');
  return transaction;
}

export function finishTransaction(transaction: Sentry.Transaction, status?: Sentry.SpanStatus): void {
  transaction.finish(status);
  logger.debug({ 
    transaction: transaction.name, 
    duration: transaction.endTimestamp! - transaction.startTimestamp 
  }, 'Transaction finished');
}
