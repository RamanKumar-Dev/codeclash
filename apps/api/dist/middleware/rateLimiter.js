"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenBucket = exports.RATE_LIMIT_CONFIGS = exports.RateLimiter = void 0;
exports.createRateLimitMiddleware = createRateLimitMiddleware;
exports.createTokenBucketMiddleware = createTokenBucketMiddleware;
const validation_1 = require("../schemas/validation");
class RateLimiter {
    constructor(redis, config) {
        this.redis = redis;
        this.config = validation_1.RateLimitConfigSchema.parse(config);
    }
    async checkLimit(key) {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        const bucketKey = `rate_limit:${key}`;
        try {
            // Use Redis pipeline for atomic operations
            const pipeline = this.redis.multi();
            // Remove expired entries
            pipeline.zRemRangeByScore(bucketKey, 0, windowStart);
            // Count current requests in window
            pipeline.zCard(bucketKey);
            // Get TTL
            pipeline.ttl(bucketKey);
            const results = await pipeline.exec();
            if (!results) {
                throw new Error('Redis pipeline failed');
            }
            const [, currentCount] = results[1];
            const [, ttl] = results[2];
            if (currentCount >= this.config.maxRequests) {
                // Rate limit exceeded
                const oldestRequest = await this.redis.zRangeWithScores(bucketKey, 0, 0);
                const retryAfter = oldestRequest.length > 0
                    ? Math.ceil((windowStart - Number(oldestRequest[0].score)) / 1000)
                    : Math.ceil(this.config.windowMs / 1000);
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime: now + (ttl > 0 ? ttl * 1000 : this.config.windowMs),
                    retryAfter: Math.max(1, retryAfter),
                };
            }
            // Add current request
            await this.redis.zAdd(bucketKey, {
                score: now,
                value: `${now}-${Math.random()}`,
            });
            // Set expiry if not exists
            if (ttl === -1) {
                await this.redis.expire(bucketKey, Math.ceil(this.config.windowMs / 1000));
            }
            return {
                allowed: true,
                remaining: Math.max(0, this.config.maxRequests - currentCount - 1),
                resetTime: now + this.config.windowMs,
            };
        }
        catch (error) {
            console.error('Rate limit check failed:', error);
            // Fail open - allow request if Redis is down
            return {
                allowed: true,
                remaining: this.config.maxRequests - 1,
                resetTime: now + this.config.windowMs,
            };
        }
    }
}
exports.RateLimiter = RateLimiter;
// Rate limiting middleware factory
function createRateLimitMiddleware(redis, config) {
    const limiter = new RateLimiter(redis, config);
    return async (req, res, next) => {
        // Use user ID if authenticated, otherwise IP
        const key = req.user?.id || req.ip || 'anonymous';
        try {
            const result = await limiter.checkLimit(key);
            // Set rate limit headers
            res.set({
                'X-RateLimit-Limit': config.maxRequests.toString(),
                'X-RateLimit-Remaining': result.remaining.toString(),
                'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
            });
            if (!result.allowed) {
                res.set('Retry-After', result.retryAfter?.toString() || '60');
                return res.status(429).json({
                    error: 'Too many requests',
                    message: config.message || 'Rate limit exceeded',
                    retryAfter: result.retryAfter,
                });
            }
            next();
        }
        catch (error) {
            console.error('Rate limiting middleware error:', error);
            // Fail open
            next();
        }
    };
}
// Predefined rate limit configurations
exports.RATE_LIMIT_CONFIGS = {
    // General API requests
    general: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
        message: 'Too many requests, please try again later',
    },
    // Code execution (more restrictive)
    execution: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10,
        message: 'Code execution limit reached, please wait before submitting again',
    },
    // Authentication attempts
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        message: 'Too many authentication attempts, please try again later',
    },
    // Matchmaking
    matchmaking: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 20,
        message: 'Matchmaking requests limited, please try again later',
    },
    // WebSocket connections
    websocket: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30,
        message: 'WebSocket connection limit reached',
    },
};
// Token bucket rate limiter for more precise control
class TokenBucket {
    constructor(redis, refillRate, bucketSize) {
        this.redis = redis;
        this.refillRate = refillRate;
        this.bucketSize = bucketSize;
    }
    async consume(key, tokens = 1) {
        const now = Date.now();
        const bucketKey = `token_bucket:${key}`;
        try {
            const pipeline = this.redis.multi();
            // Get current bucket state
            pipeline.hGetAll(bucketKey);
            const results = await pipeline.exec();
            if (!results) {
                throw new Error('Redis pipeline failed');
            }
            const [, bucketState] = results[0];
            let currentTokens = parseFloat(bucketState.tokens || this.bucketSize.toString());
            let lastRefill = parseInt(bucketState.lastRefill || now.toString());
            // Refill tokens based on elapsed time
            const elapsed = (now - lastRefill) / 1000; // seconds
            const tokensToAdd = Math.min(elapsed * this.refillRate, this.bucketSize);
            currentTokens = Math.min(currentTokens + tokensToAdd, this.bucketSize);
            if (currentTokens < tokens) {
                // Not enough tokens
                const waitTime = Math.ceil((tokens - currentTokens) / this.refillRate);
                return {
                    allowed: false,
                    remaining: Math.floor(currentTokens),
                    resetTime: now + (waitTime * 1000),
                    retryAfter: waitTime,
                };
            }
            // Consume tokens
            currentTokens -= tokens;
            // Update bucket state
            await this.redis.hSet(bucketKey, {
                tokens: currentTokens.toString(),
                lastRefill: now.toString(),
            });
            // Set expiry
            await this.redis.expire(bucketKey, 3600); // 1 hour
            return {
                allowed: true,
                remaining: Math.floor(currentTokens),
                resetTime: now + 1000,
            };
        }
        catch (error) {
            console.error('Token bucket consume failed:', error);
            // Fail open
            return {
                allowed: true,
                remaining: this.bucketSize - tokens,
                resetTime: now + 1000,
            };
        }
    }
}
exports.TokenBucket = TokenBucket;
// Token bucket middleware factory
function createTokenBucketMiddleware(redis, refillRate, bucketSize) {
    const tokenBucket = new TokenBucket(redis, refillRate, bucketSize);
    return async (req, res, next) => {
        const key = req.user?.id || req.ip || 'anonymous';
        try {
            const result = await tokenBucket.consume(key, 1);
            res.set({
                'X-RateLimit-Limit': bucketSize.toString(),
                'X-RateLimit-Remaining': result.remaining.toString(),
                'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
            });
            if (!result.allowed) {
                res.set('Retry-After', result.retryAfter?.toString() || '1');
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: 'Please wait before making another request',
                    retryAfter: result.retryAfter,
                });
            }
            next();
        }
        catch (error) {
            console.error('Token bucket middleware error:', error);
            next();
        }
    };
}
//# sourceMappingURL=rateLimiter.js.map