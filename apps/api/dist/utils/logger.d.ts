declare const appLogger: import("pino").Logger<never>;
export declare const requestLogger: (req: any, res: any, next: any) => void;
export declare const errorLogger: (error: any, req: any, res: any, next: any) => void;
export declare const battleLogger: (event: string, data: any) => void;
export declare const judgeLogger: (event: string, data: any) => void;
export declare const securityLogger: (event: string, data: any) => void;
export declare const performanceLogger: (operation: string, duration: number, metadata?: any) => void;
export declare const dbLogger: (query: string, duration: number, metadata?: any) => void;
export declare const cacheLogger: (operation: string, key: string, hit?: boolean, duration?: number) => void;
export declare const wsLogger: (event: string, socketId: string, data?: any) => void;
export declare const healthLogger: (service: string, status: string, details?: any) => void;
export declare class MetricsCollector {
    private metrics;
    increment(metric: string, value?: number): void;
    timing(metric: string, duration: number): void;
    gauge(metric: string, value: number): void;
    getMetrics(): Record<string, number>;
    reset(): void;
    startLogging(interval?: number): void;
}
export declare const metrics: MetricsCollector;
export declare function performanceMonitor(target: any, propertyName: string, descriptor: PropertyDescriptor): PropertyDescriptor;
export default appLogger;
//# sourceMappingURL=logger.d.ts.map