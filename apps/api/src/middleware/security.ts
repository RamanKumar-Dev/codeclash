import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { formatValidationError, sanitizeCode, sanitizeUserInput } from '../schemas/validation';

export interface ValidationOptions {
  sanitize?: boolean;
  stripUnknown?: boolean;
}

// Validation middleware factory
export function validateRequest(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body', options: ValidationOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let data = req[source];
      
      // Sanitize input if requested
      if (options.sanitize) {
        data = sanitizeInput(data);
      }

      // Validate against schema
      const result = schema.parse(data);
      
      // Replace request data with validated data
      req[source] = result;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          message: formatValidationError(error),
          details: error.errors,
        });
      }
      
      console.error('Validation error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Validation process failed',
      });
    }
  };
}

// Recursive input sanitization
function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    return sanitizeUserInput(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeInput(item));
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

// Code sanitization middleware
export function sanitizeCodeMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.body.code) {
    req.body.code = sanitizeCode(req.body.code);
  }
  next();
}

// XSS protection middleware
export function xssProtection(req: Request, res: Response, next: NextFunction) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' ws: wss:;");
  
  next();
}

// IP-based rate limiting for suspicious activity
export class SuspiciousActivityMonitor {
  private suspiciousIPs = new Set<string>();
  private ipAttempts = new Map<string, number>();
  private readonly MAX_ATTEMPTS = 10;
  private readonly WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  isSuspicious(ip: string): boolean {
    return this.suspiciousIPs.has(ip);
  }

  recordAttempt(ip: string): boolean {
    const attempts = this.ipAttempts.get(ip) || 0;
    this.ipAttempts.set(ip, attempts + 1);

    if (attempts + 1 >= this.MAX_ATTEMPTS) {
      this.suspiciousIPs.add(ip);
      
      // Clear after window
      setTimeout(() => {
        this.suspiciousIPs.delete(ip);
        this.ipAttempts.delete(ip);
      }, this.WINDOW_MS);

      return true; // Marked as suspicious
    }

    return false;
  }

  clearSuspicious(ip: string): void {
    this.suspiciousIPs.delete(ip);
    this.ipAttempts.delete(ip);
  }
}

// Suspicious activity middleware
const activityMonitor = new SuspiciousActivityMonitor();

export function suspiciousActivityMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (activityMonitor.isSuspicious(ip)) {
    return res.status(429).json({
      error: 'Suspicious activity detected',
      message: 'Too many failed attempts. Please try again later.',
    });
  }

  next();
}

// JWT verification middleware
export function verifyJWT(token: string): any {
  const jwt = require('jsonwebtoken');
  
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Authentication middleware with JWT
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No token provided',
    });
  }

  try {
    const decoded = verifyJWT(token);
    req.user = decoded;
    next();
  } catch (error) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    activityMonitor.recordAttempt(ip);
    
    return res.status(403).json({
      error: 'Invalid token',
      message: 'Authentication failed',
    });
  }
}

// Role-based access control
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !('role' in req.user) || !roles.includes((req.user as any).role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Required role not found',
      });
    }

    next();
  };
}

// Admin role middleware
export const requireAdmin = requireRole(['admin']);

// Content security middleware
export function contentSecurityCheck(req: Request, res: Response, next: NextFunction) {
  // Check for malicious patterns in request
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /exec\s*\(/gi,
  ];

  const checkString = (str: string) => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };

  const checkObject = (obj: any) => {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && checkString(value)) {
        return true;
      }
      if (typeof value === 'object' && value !== null && checkObject(value)) {
        return true;
      }
    }
    return false;
  };

  // Check request body
  if (req.body && checkObject(req.body)) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    activityMonitor.recordAttempt(ip);
    
    return res.status(400).json({
      error: 'Invalid content',
      message: 'Request contains potentially malicious content',
    });
  }

  next();
}

// Request size limiter
export function requestSizeLimiter(maxSize: number = 10 * 1024 * 1024) { // 10MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        error: 'Request too large',
        message: `Request size exceeds limit of ${maxSize} bytes`,
      });
    }

    next();
  };
}

// CORS configuration for production
export const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
};

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Remove server information
  res.removeHeader('Server');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
