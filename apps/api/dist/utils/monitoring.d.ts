import * as Sentry from '@sentry/node';
export declare function initializeSentry(): void;
export declare function captureException(error: Error, context?: any): void;
export declare function captureMessage(message: string, level?: Sentry.Severity): void;
export declare function setUser(user: Sentry.User): void;
export declare function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void;
export declare function performHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, boolean>;
    timestamp: string;
}>;
export declare function startTransaction(name: string, op: string): Sentry.Transaction;
export declare function finishTransaction(transaction: Sentry.Transaction, status?: Sentry.SpanStatus): void;
//# sourceMappingURL=monitoring.d.ts.map