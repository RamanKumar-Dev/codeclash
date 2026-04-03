import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';

interface AuthRequest extends Request {
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
  elo?: number;
}

export class AuthMiddleware {
  private static JWT_SECRET = process.env.JWT_SECRET || 'mvp-secret-key';
  private static JWT_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

  // Rate limiting for auth endpoints
  static rateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Generate JWT token
  static generateToken(user: { id: string; username: string; email: string; elo?: number }): string {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      elo: (user as any).elo || 1000,
    };

    return jwt.sign(payload, this.JWT_SECRET as string, { expiresIn: this.JWT_EXPIRES_IN });
  }

  // Verify JWT token
  static verifyToken(token: string): JWTPayload {
    return jwt.verify(token, this.JWT_SECRET as string) as JWTPayload;
  }

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Authentication middleware
  static authenticate = (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }

      const payload = this.verifyToken(token);
      
      // Attach user info to request
      (req as any).user = {
        id: payload.userId,
        username: payload.username,
        email: payload.email,
      };

      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Register endpoint
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, email, password } = req.body;

      // Basic validation
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { username }
          ]
        }
      });

      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      // Create new user
      const hashedPassword = await AuthMiddleware.hashPassword(password);

      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash: hashedPassword,
          elo: 1000, // Starting ELO
          wins: 0,
          losses: 0,
        },
        select: {
          id: true,
          username: true,
          email: true,
          elo: true,
          wins: true,
          losses: true,
          createdAt: true,
        }
      });

      const token = AuthMiddleware.generateToken(newUser);

      res.status(201).json({
        user: newUser,
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      next(error);
    }
  }

  // Login endpoint
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          username: true,
          email: true,
          passwordHash: true,
          elo: true,
          wins: true,
          losses: true,
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValid = await AuthMiddleware.verifyPassword(password, user.passwordHash);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Remove password hash from response
      const { passwordHash, ...userWithoutPassword } = user;

      const token = AuthMiddleware.generateToken(userWithoutPassword);

      res.json({
        user: userWithoutPassword,
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      next(error);
    }
  }

  // Get profile endpoint
  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          elo: true,
          wins: true,
          losses: true,
          createdAt: true,
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Get profile error:', error);
      next(error);
    }
  }
}
