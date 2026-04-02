import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createClient, RedisClientType } from 'redis';
import { User } from '@code-clash/shared-types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  tokenType: 'access' | 'refresh';
}

export class AuthService {
  private redis: RedisClientType;
  private readonly ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly RATE_LIMIT_WINDOW = 5 * 60; // 5 minutes
  private readonly RATE_LIMIT_MAX = 5; // 5 requests per window

  constructor(redis: RedisClientType) {
    this.redis = redis;
  }

  // Generate access and refresh tokens
  async generateTokens(user: User): Promise<AuthTokens> {
    const payload: Omit<JwtPayload, 'tokenType'> = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = jwt.sign(
      { ...payload, tokenType: 'access' },
      process.env.JWT_SECRET!,
      { expiresIn: `${this.ACCESS_TOKEN_TTL}s` }
    );

    const refreshToken = jwt.sign(
      { ...payload, tokenType: 'refresh' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: `${this.REFRESH_TOKEN_TTL}s` }
    );

    // Store refresh token in Redis for revocation capability
    await this.redis.setEx(
      `refresh_token:${user.id}:${refreshToken.slice(-8)}`,
      this.REFRESH_TOKEN_TTL,
      refreshToken
    );

    return { accessToken, refreshToken };
  }

  // Verify access token
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      
      if (payload.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }
      
      return payload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  // Verify refresh token and generate new access token
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
      
      if (payload.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists in Redis
      const storedToken = await this.redis.get(`refresh_token:${payload.userId}:${refreshToken.slice(-8)}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Refresh token revoked');
      }

      // Generate new access token
      const newPayload: Omit<JwtPayload, 'tokenType'> = {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
      };

      return jwt.sign(
        { ...newPayload, tokenType: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: `${this.ACCESS_TOKEN_TTL}s` }
      );
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Revoke refresh token
  async revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.redis.del(`refresh_token:${userId}:${refreshToken.slice(-8)}`);
  }

  // Revoke all refresh tokens for user
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const pattern = `refresh_token:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  // Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate verification token
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate password reset token
  generatePasswordResetToken(): { token: string; expires: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return { token, expires };
  }

  // Redis-based rate limiting for auth endpoints
  async checkRateLimit(identifier: string, ip: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:auth:${identifier}:${ip}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, this.RATE_LIMIT_WINDOW);
    }

    const ttl = await this.redis.ttl(key);
    const resetTime = Date.now() + (ttl * 1000);

    return {
      allowed: current <= this.RATE_LIMIT_MAX,
      remaining: Math.max(0, this.RATE_LIMIT_MAX - current),
      resetTime,
    };
  }

  // Email verification
  async sendVerificationEmail(user: User): Promise<void> {
    const token = this.generateVerificationToken();
    
    // Store token in Redis
    await this.redis.setEx(
      `email_verification:${user.id}`,
      24 * 60 * 60, // 24 hours
      token
    );

    // TODO: Integrate with email service
    console.log(`Verification email sent to ${user.email} with token ${token}`);
  }

  // Verify email
  async verifyEmail(userId: string, token: string): Promise<boolean> {
    const storedToken = await this.redis.get(`email_verification:${userId}`);
    
    if (!storedToken || storedToken !== token) {
      return false;
    }

    await this.redis.del(`email_verification:${userId}`);
    return true;
  }

  // Password reset
  async sendPasswordResetEmail(user: User): Promise<void> {
    const { token, expires } = this.generatePasswordResetToken();
    
    // Store token in Redis
    await this.redis.setEx(
      `password_reset:${user.id}`,
      10 * 60, // 10 minutes
      JSON.stringify({ token, expires: expires.toISOString() })
    );

    // TODO: Integrate with email service
    console.log(`Password reset email sent to ${user.email} with token ${token}`);
  }

  // Verify password reset token
  async verifyPasswordResetToken(userId: string, token: string): Promise<boolean> {
    const stored = await this.redis.get(`password_reset:${userId}`);
    
    if (!stored) {
      return false;
    }

    const { token: storedToken, expires } = JSON.parse(stored);
    
    if (storedToken !== token || new Date() > new Date(expires)) {
      return false;
    }

    return true;
  }

  // Clear password reset token
  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.redis.del(`password_reset:${userId}`);
  }
}

// Middleware for JWT authentication
export function authenticateToken(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }

      const payload = await authService.verifyAccessToken(token);
      (req as any).user = payload;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid access token' });
    }
  };
}

// Middleware for role-based access
export function requireRole(requiredRole: 'admin' | 'moderator') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user || (user.role !== requiredRole && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Rate limiting middleware
export function authRateLimit(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.body.username || req.body.email || req.ip;
    const ip = req.ip;
    
    const rateLimit = await authService.checkRateLimit(identifier, ip);
    
    res.set({
      'X-RateLimit-Limit': authService['RATE_LIMIT_MAX'],
      'X-RateLimit-Remaining': rateLimit.remaining,
      'X-RateLimit-Reset': rateLimit.resetTime,
    });

    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Too many requests',
        resetTime: rateLimit.resetTime
      });
    }
    
    next();
  };
}
