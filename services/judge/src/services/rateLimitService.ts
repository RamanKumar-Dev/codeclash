import { createClient, RedisClientType } from 'redis';

export class RateLimitService {
  private redis: RedisClientType;

  constructor(redis: RedisClientType) {
    this.redis = redis;
  }

  async checkSubmissionRateLimit(userId: string, maxSubmissions: number = 10, windowMs: number = 60000): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:submission:${userId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Remove old entries outside the window
      await this.redis.zRemRangeByScore(key, 0, windowStart);

      // Count current submissions in window
      const currentCount = await this.redis.zCard(key);

      if (currentCount >= maxSubmissions) {
        // Get the oldest submission time for reset time calculation
        const oldest = await this.redis.zRange(key, 0, 0);
        const resetTime = oldest.length > 0 ? parseInt(oldest[0].score) + windowMs : now + windowMs;

        return {
          allowed: false,
          remaining: 0,
          resetTime
        };
      }

      // Add this submission
      await this.redis.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      await this.redis.expire(key, Math.ceil(windowMs / 1000));

      return {
        allowed: true,
        remaining: maxSubmissions - currentCount - 1,
        resetTime: now + windowMs
      };

    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow the request if rate limiting fails
      return { allowed: true, remaining: maxSubmissions - 1, resetTime: now + windowMs };
    }
  }

  async checkConnectionRateLimit(userId: string, maxConnections: number = 5, windowMs: number = 60000): Promise<boolean> {
    const key = `rate_limit:connection:${userId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      await this.redis.zRemRangeByScore(key, 0, windowStart);
      const currentCount = await this.redis.zCard(key);

      if (currentCount >= maxConnections) {
        return false;
      }

      await this.redis.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      await this.redis.expire(key, Math.ceil(windowMs / 1000));

      return true;
    } catch (error) {
      console.error('Connection rate limit check failed:', error);
      return true; // Fail open
    }
  }

  async checkGeneralRateLimit(identifier: string, maxRequests: number, windowMs: number): Promise<boolean> {
    const key = `rate_limit:general:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      await this.redis.zRemRangeByScore(key, 0, windowStart);
      const currentCount = await this.redis.zCard(key);

      if (currentCount >= maxRequests) {
        return false;
      }

      await this.redis.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      await this.redis.expire(key, Math.ceil(windowMs / 1000));

      return true;
    } catch (error) {
      console.error('General rate limit check failed:', error);
      return true; // Fail open
    }
  }
}
