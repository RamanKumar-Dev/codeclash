import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
import { RateLimitConfig } from '../schemas/validation';
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
export declare class RateLimiter {
    private redis;
    private config;
    constructor(redis: RedisClientType, config: RateLimitConfig);
    checkLimit(key: string): Promise<RateLimitResult>;
}
export declare function createRateLimitMiddleware(redis: RedisClientType, config: RateLimitConfig): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const RATE_LIMIT_CONFIGS: {
    general: {
        windowMs: number;
        maxRequests: number;
        message: string;
    };
    execution: {
        windowMs: number;
        maxRequests: number;
        message: string;
    };
    auth: {
        windowMs: number;
        maxRequests: number;
        message: string;
    };
    matchmaking: {
        windowMs: number;
        maxRequests: number;
        message: string;
    };
    websocket: {
        windowMs: number;
        maxRequests: number;
        message: string;
    };
};
export declare class TokenBucket {
    private redis;
    private refillRate;
    private bucketSize;
    constructor(redis: RedisClientType, refillRate: number, bucketSize: number);
    consume(key: string, tokens?: number): Promise<RateLimitResult>;
}
export declare function createTokenBucketMiddleware(redis: RedisClientType, refillRate: number, bucketSize: number): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=rateLimiter.d.ts.map