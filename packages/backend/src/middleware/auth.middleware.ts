import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redisService } from '../services/redis.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  iat: number;
  exp: number;
}

export class AuthMiddleware {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  }

  // Generate JWT token
  generateToken(userId: string, username: string, email: string): string {
    return jwt.sign(
      { userId, username, email },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  // Verify JWT token
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Express middleware for REST API authentication
  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      try {
        const payload = this.verifyToken(token);
        
        // Check if token is blacklisted (for logout functionality)
        const isBlacklisted = await redisService.get(`blacklist:${token}`);
        if (isBlacklisted) {
          res.status(401).json({ error: 'Token has been revoked' });
          return;
        }

        // Attach user info to request
        req.user = {
          id: payload.userId,
          username: payload.username,
          email: payload.email
        };

        next();
      } catch (jwtError) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  // Socket.io authentication middleware
  authenticateSocket = async (socket: any, next: (err?: Error) => void): Promise<void> => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('No token provided'));
      }

      try {
        const payload = this.verifyToken(token);
        
        // Check if token is blacklisted
        const isBlacklisted = await redisService.get(`blacklist:${token}`);
        if (isBlacklisted) {
          return next(new Error('Token has been revoked'));
        }

        // Attach user info to socket
        socket.data.user = {
          id: payload.userId,
          username: payload.username,
          email: payload.email
        };

        socket.data.userId = payload.userId;
        socket.data.username = payload.username;

        next();
      } catch (jwtError) {
        next(new Error('Invalid token'));
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  };

  // Logout / revoke token
  revokeToken = async (token: string): Promise<void> => {
    try {
      const payload = this.verifyToken(token);
      const timeUntilExpiry = payload.exp * 1000 - Date.now();
      
      if (timeUntilExpiry > 0) {
        // Add token to blacklist with TTL until expiry
        await redisService.set(`blacklist:${token}`, '1', 'EX', Math.ceil(timeUntilExpiry / 1000));
      }
    } catch (error) {
      console.error('Token revocation error:', error);
      throw new Error('Failed to revoke token');
    }
  };

  // Refresh token
  refreshToken = async (token: string): Promise<string> => {
    try {
      const payload = this.verifyToken(token);
      
      // Revoke old token
      await this.revokeToken(token);
      
      // Generate new token
      return this.generateToken(payload.userId, payload.username, payload.email);
    } catch (error) {
      console.error('Token refresh error:', error);
      throw new Error('Failed to refresh token');
    }
  };

  // Check if user has required role (for future role-based access)
  hasRole = (requiredRole: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // For now, all authenticated users have 'user' role
      // This can be extended to check user roles from database
      const userRole = 'user'; // Would fetch from database in production
      
      if (userRole !== requiredRole && userRole !== 'admin') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    };
  };

  // Rate limiting middleware
  rateLimit = (maxRequests: number, windowMs: number) => {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const userId = req.user?.id || req.ip;
      const now = Date.now();
      const userRequests = requests.get(userId);

      if (!userRequests || now > userRequests.resetTime) {
        requests.set(userId, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (userRequests.count >= maxRequests) {
        res.status(429).json({ 
          error: 'Too many requests',
          retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
        });
        return;
      }

      userRequests.count++;
      next();
    };
  };

  // Validate required fields
  validateRequired = (fields: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const missing = fields.filter(field => !req.body[field]);
      
      if (missing.length > 0) {
        res.status(400).json({ 
          error: 'Missing required fields',
          fields: missing 
        });
        return;
      }

      next();
    };
  };
}

export const authMiddleware = new AuthMiddleware();
