import { redisService } from './redis.service';
import { Puzzle, LeaderboardResponse, User } from '@code-clash/shared-types';

export class CacheService {
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly LEADERBOARD_TTL = 30; // 30 seconds
  private readonly USER_PROFILE_TTL = 60; // 1 minute
  private readonly PUZZLE_TTL = 600; // 10 minutes

  // Puzzle caching
  async cachePuzzle(puzzle: Puzzle): Promise<void> {
    const key = `puzzle:${puzzle.id}`;
    await redisService.set(key, JSON.stringify(puzzle), 'EX', this.PUZZLE_TTL);
  }

  async getPuzzle(puzzleId: string): Promise<Puzzle | null> {
    const key = `puzzle:${puzzleId}`;
    const cached = await redisService.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async cachePuzzleList(puzzles: Puzzle[], category?: string): Promise<void> {
    const key = category ? `puzzles:${category}` : 'puzzles:all';
    await redisService.set(key, JSON.stringify(puzzles), 'EX', this.PUZZLE_TTL);
  }

  async getPuzzleList(category?: string): Promise<Puzzle[] | null> {
    const key = category ? `puzzles:${category}` : 'puzzles:all';
    const cached = await redisService.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidatePuzzle(puzzleId: string): Promise<void> {
    const key = `puzzle:${puzzleId}`;
    await redisService.del(key);
    
    // Also invalidate puzzle lists
    await redisService.del('puzzles:all');
    const categories = ['easy', 'medium', 'hard', 'expert'];
    for (const category of categories) {
      await redisService.del(`puzzles:${category}`);
    }
  }

  // Leaderboard caching
  async cacheLeaderboard(response: LeaderboardResponse, type: string, page: number = 1): Promise<void> {
    const key = `leaderboard:${type}:page:${page}`;
    await redisService.set(key, JSON.stringify(response), 'EX', this.LEADERBOARD_TTL);
  }

  async getLeaderboard(type: string, page: number = 1): Promise<LeaderboardResponse | null> {
    const key = `leaderboard:${type}:page:${page}`;
    const cached = await redisService.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateLeaderboard(type?: string): Promise<void> {
    if (type) {
      // Invalidate specific leaderboard type pages
      for (let page = 1; page <= 20; page++) { // Assume max 20 pages
        await redisService.del(`leaderboard:${type}:page:${page}`);
      }
    } else {
      // Invalidate all leaderboards
      const types = ['season', 'alltime', 'weekly'];
      for (const type of types) {
        await this.invalidateLeaderboard(type);
      }
    }
  }

  // User profile caching
  async cacheUserProfile(user: User): Promise<void> {
    const key = `user:${user.id}`;
    await redisService.set(key, JSON.stringify(user), 'EX', this.USER_PROFILE_TTL);
  }

  async getUserProfile(userId: string): Promise<User | null> {
    const key = `user:${userId}`;
    const cached = await redisService.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    const key = `user:${userId}`;
    await redisService.del(key);
  }

  // Battle room caching
  async cacheBattleRoom(roomId: string, roomData: any): Promise<void> {
    const key = `battle_room:${roomId}`;
    await redisService.set(key, JSON.stringify(roomData), 'EX', 3600); // 1 hour
  }

  async getBattleRoom(roomId: string): Promise<any | null> {
    const key = `battle_room:${roomId}`;
    const cached = await redisService.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateBattleRoom(roomId: string): Promise<void> {
    const key = `battle_room:${roomId}`;
    await redisService.del(key);
  }

  // Season data caching
  async cacheCurrentSeason(season: any): Promise<void> {
    const key = 'season:current';
    await redisService.set(key, JSON.stringify(season), 'EX', 3600); // 1 hour
  }

  async getCurrentSeason(): Promise<any | null> {
    const key = 'season:current';
    const cached = await redisService.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateCurrentSeason(): Promise<void> {
    const key = 'season:current';
    await redisService.del(key);
  }

  // Matchmaking queue caching
  async getMatchmakingQueue(): Promise<string[]> {
    const key = 'matchmaking:queue';
    const queue = await redisService.lrange(key, 0, -1);
    return queue || [];
  }

  async addToMatchmakingQueue(userId: string): Promise<void> {
    const key = 'matchmaking:queue';
    await redisService.lpush(key, userId);
    await redisService.expire(key, 300); // 5 minutes TTL
  }

  async removeFromMatchmakingQueue(userId: string): Promise<void> {
    const key = 'matchmaking:queue';
    await redisService.lrem(key, 1, userId);
  }

  // Rate limiting cache
  async checkRateLimit(identifier: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    await redisService.zremrangebyscore(key, 0, windowStart);

    // Get current count
    const current = await redisService.zcard(key);

    if (current >= limit) {
      const oldest = await redisService.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldest.length > 0 ? parseInt(oldest[1]) + windowMs : now + windowMs;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }

    // Add current request
    await redisService.zadd(key, now, identifier);
    await redisService.expire(key, Math.ceil(windowMs / 1000));

    return {
      allowed: true,
      remaining: limit - current - 1,
      resetTime: now + windowMs
    };
  }

  // Generic caching methods
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const actualTtl = ttl || this.DEFAULT_TTL;
    await redisService.set(key, JSON.stringify(value), 'EX', actualTtl);
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = await redisService.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async del(key: string): Promise<void> {
    await redisService.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await redisService.get(key);
    return result !== null;
  }

  // Cache warming
  async warmCache(): Promise<void> {
    console.log('🔥 Warming up cache...');
    
    try {
      // Cache frequently accessed data
      // This would be called on server startup
      
      // Cache current season
      // const currentSeason = await this.seasonService.getCurrentSeason();
      // if (currentSeason) {
      //   await this.cacheCurrentSeason(currentSeason);
      // }

      // Cache popular puzzles
      // const popularPuzzles = await this.puzzleService.getPopularPuzzles();
      // await this.cachePuzzleList(popularPuzzles);

      console.log('✅ Cache warmed successfully');
    } catch (error) {
      console.error('❌ Cache warming failed:', error);
    }
  }

  // Cache statistics
  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
    topKeys: Array<{ key: string; size: number; ttl: number }>;
  }> {
    try {
      // Get info from Redis
      const info = await redisService.get('info') || '';
      const keyspace = info.match(/db\d+:keys=(\d+),expires=(\d+)/);
      
      const totalKeys = keyspace ? parseInt(keyspace[1]) : 0;
      
      // This is a simplified implementation
      // In production, you'd want more sophisticated tracking
      return {
        totalKeys,
        memoryUsage: 'N/A', // Would get from Redis INFO memory
        hitRate: 0.85, // Would track hits/misses
        topKeys: []
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalKeys: 0,
        memoryUsage: 'N/A',
        hitRate: 0,
        topKeys: []
      };
    }
  }

  // Cache cleanup
  async cleanupExpired(): Promise<void> {
    console.log('🧹 Cleaning up expired cache entries...');
    
    try {
      // Redis automatically handles expired keys
      // This could be used for manual cleanup of specific patterns
      
      // Example: Clean up old battle rooms
      const battleRooms = await redisService.keys('battle_room:*');
      for (const roomKey of battleRooms) {
        const ttl = await redisService.ttl(roomKey);
        if (ttl === -1) { // No expiry set
          await redisService.expire(roomKey, 3600); // Set 1 hour expiry
        }
      }

      console.log('✅ Cache cleanup completed');
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
    }
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisService.keys(pattern);
      if (keys.length > 0) {
        await Promise.all(keys.map(key => redisService.del(key)));
        console.log(`🗑️ Invalidated ${keys.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      console.error(`Failed to invalidate pattern ${pattern}:`, error);
    }
  }

  // Batch operations
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    const results = await Promise.all(keys.map(key => this.get<T>(key)));
    return results;
  }

  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    await Promise.all(
      entries.map(({ key, value, ttl }) => this.set(key, value, ttl))
    );
  }
}

export const cacheService = new CacheService();
