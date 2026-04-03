"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PuzzleCacheService = exports.CacheService = void 0;
exports.cacheMiddleware = cacheMiddleware;
exports.cacheInvalidationMiddleware = cacheInvalidationMiddleware;
const redis_1 = require("redis");
class CacheService {
    constructor(redis) {
        this.stats = {
            hits: 0,
            misses: 0,
        };
        this.redis = redis;
    }
    // Generic cache get with JSON parsing
    async get(key) {
        try {
            const value = await this.redis.get(key);
            if (value === null) {
                this.stats.misses++;
                return null;
            }
            this.stats.hits++;
            return JSON.parse(value);
        }
        catch (error) {
            console.error('Cache get error:', error);
            this.stats.misses++;
            return null;
        }
    }
    // Generic cache set with JSON serialization
    async set(key, value, options = {}) {
        try {
            const serialized = JSON.stringify(value);
            if (options.ttl) {
                await this.redis.setEx(key, options.ttl, serialized);
            }
            else {
                await this.redis.set(key, serialized);
            }
            // Store tags for invalidation
            if (options.tags && options.tags.length > 0) {
                await this.addTags(key, options.tags);
            }
        }
        catch (error) {
            console.error('Cache set error:', error);
        }
    }
    // Delete cache key
    async del(key) {
        try {
            await this.redis.del(key);
        }
        catch (error) {
            console.error('Cache delete error:', error);
        }
    }
    // Check if key exists
    async exists(key) {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        }
        catch (error) {
            console.error('Cache exists error:', error);
            return false;
        }
    }
    // Add tags to a cache key
    async addTags(key, tags) {
        const pipeline = this.redis.multi();
        for (const tag of tags) {
            pipeline.sAdd(`tag:${tag}`, key);
            pipeline.expire(`tag:${tag}`, 86400); // Tags expire after 24 hours
        }
        await pipeline.exec();
    }
    // Invalidate cache by tags
    async invalidateByTag(tag) {
        try {
            const keys = await this.redis.sMembers(`tag:${tag}`);
            if (keys.length > 0) {
                await this.redis.del(keys);
                await this.redis.del(`tag:${tag}`);
            }
        }
        catch (error) {
            console.error('Cache invalidation error:', error);
        }
    }
    // Invalidate multiple tags
    async invalidateByTags(tags) {
        await Promise.all(tags.map(tag => this.invalidateByTag(tag)));
    }
    // Get cache statistics
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: total > 0 ? this.stats.hits / total : 0,
            totalKeys: 0, // Would need to be tracked separately
        };
    }
    // Reset statistics
    resetStats() {
        this.stats = { hits: 0, misses: 0 };
    }
    // Cache warming for frequently accessed data
    async warmCache() {
        console.log('Starting cache warm-up...');
        // This would be implemented based on application needs
        // For example, pre-loading popular puzzles, leaderboards, etc.
        console.log('Cache warm-up completed');
    }
    // Flush all cache (use with caution)
    async flushAll() {
        try {
            await this.redis.flushDb();
            console.log('Cache flushed');
        }
        catch (error) {
            console.error('Cache flush error:', error);
        }
    }
}
exports.CacheService = CacheService;
// Specialized cache services
class PuzzleCacheService {
    constructor(cache) {
        this.PUZZLE_TTL = 600; // 10 minutes
        this.LEADERBOARD_TTL = 30; // 30 seconds
        this.PROFILE_TTL = 60; // 1 minute
        this.cache = cache;
    }
    // Puzzle caching
    async getPuzzle(id) {
        return this.cache.get(`puzzle:${id}`);
    }
    async setPuzzle(id, puzzle) {
        await this.cache.set(`puzzle:${id}`, puzzle, {
            ttl: this.PUZZLE_TTL,
            tags: ['puzzle', `puzzle:${id}`],
        });
    }
    async invalidatePuzzle(id) {
        await this.cache.invalidateByTags([`puzzle:${id}`]);
    }
    // Puzzle list caching
    async getPuzzleList(filters) {
        const key = `puzzles:list:${JSON.stringify(filters)}`;
        return this.cache.get(key);
    }
    async setPuzzleList(filters, puzzles) {
        const key = `puzzles:list:${JSON.stringify(filters)}`;
        await this.cache.set(key, puzzles, {
            ttl: this.PUZZLE_TTL,
            tags: ['puzzles', 'puzzle-list'],
        });
    }
    // Leaderboard caching
    async getLeaderboard(type = 'global') {
        return this.cache.get(`leaderboard:${type}`);
    }
    async setLeaderboard(type, leaderboard) {
        await this.cache.set(`leaderboard:${type}`, leaderboard, {
            ttl: this.LEADERBOARD_TTL,
            tags: ['leaderboard', `leaderboard:${type}`],
        });
    }
    async invalidateLeaderboard(type) {
        const tags = type ? [`leaderboard:${type}`] : ['leaderboard'];
        await this.cache.invalidateByTags(tags);
    }
    // User profile caching
    async getUserProfile(userId) {
        return this.cache.get(`profile:${userId}`);
    }
    async setUserProfile(userId, profile) {
        await this.cache.set(`profile:${userId}`, profile, {
            ttl: this.PROFILE_TTL,
            tags: ['profile', `profile:${userId}`],
        });
    }
    async invalidateUserProfile(userId) {
        await this.cache.invalidateByTags([`profile:${userId}`]);
    }
    // User stats caching
    async getUserStats(userId) {
        return this.cache.get(`stats:${userId}`);
    }
    async setUserStats(userId, stats) {
        await this.cache.set(`stats:${userId}`, stats, {
            ttl: this.PROFILE_TTL,
            tags: ['stats', `stats:${userId}`],
        });
    }
    async invalidateUserStats(userId) {
        await this.cache.invalidateByTags([`stats:${userId}`]);
    }
    // Matchmaking queue caching
    async getQueueSize() {
        return this.cache.get('queue:size');
    }
    async setQueueSize(size) {
        await this.cache.set('queue:size', size, {
            ttl: 30, // 30 seconds
            tags: ['queue'],
        });
    }
    // Battle room caching
    async getBattleRoom(roomId) {
        return this.cache.get(`battle:${roomId}`);
    }
    async setBattleRoom(roomId, room) {
        await this.cache.set(`battle:${roomId}`, room, {
            ttl: 1800, // 30 minutes
            tags: ['battle', `battle:${roomId}`],
        });
    }
    async invalidateBattleRoom(roomId) {
        await this.cache.invalidateByTags([`battle:${roomId}`]);
    }
    // Popular puzzles caching
    async getPopularPuzzles() {
        return this.cache.get('popular:puzzles');
    }
    async setPopularPuzzles(puzzles) {
        await this.cache.set('popular:puzzles', puzzles, {
            ttl: this.PUZZLE_TTL,
            tags: ['popular', 'puzzles'],
        });
    }
    // Recent submissions caching
    async getRecentSubmissions(userId, limit = 10) {
        return this.cache.get(`submissions:${userId}:${limit}`);
    }
    async setRecentSubmissions(userId, submissions, limit = 10) {
        await this.cache.set(`submissions:${userId}:${limit}`, submissions, {
            ttl: this.PROFILE_TTL,
            tags: ['submissions', `submissions:${userId}`],
        });
    }
    async invalidateUserSubmissions(userId) {
        await this.cache.invalidateByTags([`submissions:${userId}`]);
    }
    // Cache health check
    async healthCheck() {
        try {
            const stats = this.cache.getStats();
            const testKey = 'health:check';
            const testValue = { timestamp: Date.now() };
            await this.cache.set(testKey, testValue, { ttl: 10 });
            const retrieved = await this.cache.get(testKey);
            if (retrieved && retrieved.timestamp === testValue.timestamp) {
                return {
                    status: 'healthy',
                    details: {
                        stats,
                        connectivity: 'ok',
                    },
                };
            }
            else {
                return {
                    status: 'degraded',
                    details: {
                        stats,
                        connectivity: 'failed',
                    },
                };
            }
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }
}
exports.PuzzleCacheService = PuzzleCacheService;
// Cache middleware factory
function cacheMiddleware(ttl = 300, keyGenerator) {
    const cache = new CacheService((0, redis_1.createClient)({ url: process.env.REDIS_URL }));
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }
        const cacheKey = keyGenerator ? keyGenerator(req) : `cache:${req.originalUrl}`;
        try {
            const cached = await cache.get(cacheKey);
            if (cached) {
                res.set('X-Cache', 'HIT');
                return res.json(cached);
            }
            // Intercept res.json to cache the response
            const originalJson = res.json;
            res.json = function (data) {
                cache.set(cacheKey, data, { ttl });
                res.set('X-Cache', 'MISS');
                return originalJson.call(this, data);
            };
            next();
        }
        catch (error) {
            console.error('Cache middleware error:', error);
            next();
        }
    };
}
// Cache invalidation middleware for POST/PUT/DELETE
function cacheInvalidationMiddleware(tags) {
    const cache = new CacheService((0, redis_1.createClient)({ url: process.env.REDIS_URL }));
    return async (req, res, next) => {
        const originalSend = res.send;
        res.send = function (data) {
            // Invalidate cache on successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cache.invalidateByTags(tags).catch(console.error);
            }
            return originalSend.call(this, data);
        };
        next();
    };
}
//# sourceMappingURL=cacheService.js.map