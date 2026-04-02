import { createClient, RedisClientType } from 'redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
}

export class CacheService {
  private redis: RedisClientType;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(redis: RedisClientType) {
    this.redis = redis;
  }

  // Generic cache get with JSON parsing
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  // Generic cache set with JSON serialization
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      
      if (options.ttl) {
        await this.redis.setEx(key, options.ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      // Store tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addTags(key, options.tags);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // Delete cache key
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  // Add tags to a cache key
  private async addTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.multi();
    
    for (const tag of tags) {
      pipeline.sAdd(`tag:${tag}`, key);
      pipeline.expire(`tag:${tag}`, 86400); // Tags expire after 24 hours
    }
    
    await pipeline.exec();
  }

  // Invalidate cache by tags
  async invalidateByTag(tag: string): Promise<void> {
    try {
      const keys = await this.redis.sMembers(`tag:${tag}`);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        await this.redis.del(`tag:${tag}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Invalidate multiple tags
  async invalidateByTags(tags: string[]): Promise<void> {
    await Promise.all(tags.map(tag => this.invalidateByTag(tag)));
  }

  // Get cache statistics
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      totalKeys: 0, // Would need to be tracked separately
    };
  }

  // Reset statistics
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  // Cache warming for frequently accessed data
  async warmCache(): Promise<void> {
    console.log('Starting cache warm-up...');
    
    // This would be implemented based on application needs
    // For example, pre-loading popular puzzles, leaderboards, etc.
    
    console.log('Cache warm-up completed');
  }

  // Flush all cache (use with caution)
  async flushAll(): Promise<void> {
    try {
      await this.redis.flushDb();
      console.log('Cache flushed');
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }
}

// Specialized cache services
export class PuzzleCacheService {
  private cache: CacheService;
  private readonly PUZZLE_TTL = 600; // 10 minutes
  private readonly LEADERBOARD_TTL = 30; // 30 seconds
  private readonly PROFILE_TTL = 60; // 1 minute

  constructor(cache: CacheService) {
    this.cache = cache;
  }

  // Puzzle caching
  async getPuzzle(id: string): Promise<any | null> {
    return this.cache.get(`puzzle:${id}`);
  }

  async setPuzzle(id: string, puzzle: any): Promise<void> {
    await this.cache.set(`puzzle:${id}`, puzzle, {
      ttl: this.PUZZLE_TTL,
      tags: ['puzzle', `puzzle:${id}`],
    });
  }

  async invalidatePuzzle(id: string): Promise<void> {
    await this.cache.invalidateByTags([`puzzle:${id}`]);
  }

  // Puzzle list caching
  async getPuzzleList(filters: any): Promise<any[] | null> {
    const key = `puzzles:list:${JSON.stringify(filters)}`;
    return this.cache.get(key);
  }

  async setPuzzleList(filters: any, puzzles: any[]): Promise<void> {
    const key = `puzzles:list:${JSON.stringify(filters)}`;
    await this.cache.set(key, puzzles, {
      ttl: this.PUZZLE_TTL,
      tags: ['puzzles', 'puzzle-list'],
    });
  }

  // Leaderboard caching
  async getLeaderboard(type: string = 'global'): Promise<any[] | null> {
    return this.cache.get(`leaderboard:${type}`);
  }

  async setLeaderboard(type: string, leaderboard: any[]): Promise<void> {
    await this.cache.set(`leaderboard:${type}`, leaderboard, {
      ttl: this.LEADERBOARD_TTL,
      tags: ['leaderboard', `leaderboard:${type}`],
    });
  }

  async invalidateLeaderboard(type?: string): Promise<void> {
    const tags = type ? [`leaderboard:${type}`] : ['leaderboard'];
    await this.cache.invalidateByTags(tags);
  }

  // User profile caching
  async getUserProfile(userId: string): Promise<any | null> {
    return this.cache.get(`profile:${userId}`);
  }

  async setUserProfile(userId: string, profile: any): Promise<void> {
    await this.cache.set(`profile:${userId}`, profile, {
      ttl: this.PROFILE_TTL,
      tags: ['profile', `profile:${userId}`],
    });
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    await this.cache.invalidateByTags([`profile:${userId}`]);
  }

  // User stats caching
  async getUserStats(userId: string): Promise<any | null> {
    return this.cache.get(`stats:${userId}`);
  }

  async setUserStats(userId: string, stats: any): Promise<void> {
    await this.cache.set(`stats:${userId}`, stats, {
      ttl: this.PROFILE_TTL,
      tags: ['stats', `stats:${userId}`],
    });
  }

  async invalidateUserStats(userId: string): Promise<void> {
    await this.cache.invalidateByTags([`stats:${userId}`]);
  }

  // Matchmaking queue caching
  async getQueueSize(): Promise<number | null> {
    return this.cache.get('queue:size');
  }

  async setQueueSize(size: number): Promise<void> {
    await this.cache.set('queue:size', size, {
      ttl: 30, // 30 seconds
      tags: ['queue'],
    });
  }

  // Battle room caching
  async getBattleRoom(roomId: string): Promise<any | null> {
    return this.cache.get(`battle:${roomId}`);
  }

  async setBattleRoom(roomId: string, room: any): Promise<void> {
    await this.cache.set(`battle:${roomId}`, room, {
      ttl: 1800, // 30 minutes
      tags: ['battle', `battle:${roomId}`],
    });
  }

  async invalidateBattleRoom(roomId: string): Promise<void> {
    await this.cache.invalidateByTags([`battle:${roomId}`]);
  }

  // Popular puzzles caching
  async getPopularPuzzles(): Promise<any[] | null> {
    return this.cache.get('popular:puzzles');
  }

  async setPopularPuzzles(puzzles: any[]): Promise<void> {
    await this.cache.set('popular:puzzles', puzzles, {
      ttl: this.PUZZLE_TTL,
      tags: ['popular', 'puzzles'],
    });
  }

  // Recent submissions caching
  async getRecentSubmissions(userId: string, limit: number = 10): Promise<any[] | null> {
    return this.cache.get(`submissions:${userId}:${limit}`);
  }

  async setRecentSubmissions(userId: string, submissions: any[], limit: number = 10): Promise<void> {
    await this.cache.set(`submissions:${userId}:${limit}`, submissions, {
      ttl: this.PROFILE_TTL,
      tags: ['submissions', `submissions:${userId}`],
    });
  }

  async invalidateUserSubmissions(userId: string): Promise<void> {
    await this.cache.invalidateByTags([`submissions:${userId}`]);
  }

  // Cache health check
  async healthCheck(): Promise<{ status: string; details: any }> {
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
      } else {
        return {
          status: 'degraded',
          details: {
            stats,
            connectivity: 'failed',
          },
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

// Cache middleware factory
export function cacheMiddleware(ttl: number = 300, keyGenerator?: (req: any) => string) {
  const cache = new CacheService(createClient({ url: process.env.REDIS_URL }));
  
  return async (req: any, res: any, next: any) => {
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
      res.json = function(data: any) {
        cache.set(cacheKey, data, { ttl });
        res.set('X-Cache', 'MISS');
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

// Cache invalidation middleware for POST/PUT/DELETE
export function cacheInvalidationMiddleware(tags: string[]) {
  const cache = new CacheService(createClient({ url: process.env.REDIS_URL }));
  
  return async (req: any, res: any, next: any) => {
    const originalSend = res.send;
    
    res.send = function(data: any) {
      // Invalidate cache on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.invalidateByTags(tags).catch(console.error);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}
