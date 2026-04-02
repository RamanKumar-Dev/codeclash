import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoSanitize from 'mongo-sanitize';

// Validation schemas using Zod
export const schemas = {
  // User registration
  register: z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be less than 20 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string()
      .email('Invalid email format')
      .max(100, 'Email must be less than 100 characters'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be less than 100 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character')
  }),

  // User login
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required')
  }),

  // Battle submission
  submitCode: z.object({
    code: z.string()
      .min(1, 'Code cannot be empty')
      .max(50000, 'Code is too long (max 50000 characters)')
      .refine((code) => !code.includes('eval(') && !code.includes('exec('), {
        message: 'Code contains potentially dangerous functions'
      }),
    language: z.enum(['javascript', 'python', 'java', 'cpp']),
    stdin: z.string().max(1000, 'Input too long').optional(),
    puzzleId: z.string().uuid('Invalid puzzle ID')
  }),

  // Spell casting
  castSpell: z.object({
    spellId: z.string().min(1, 'Spell ID is required'),
    targetUserId: z.string().uuid('Invalid target user ID').optional(),
    roomId: z.string().uuid('Invalid room ID')
  }),

  // Puzzle creation (admin)
  createPuzzle: z.object({
    title: z.string()
      .min(5, 'Title must be at least 5 characters')
      .max(100, 'Title must be less than 100 characters'),
    description: z.string()
      .min(10, 'Description must be at least 10 characters')
      .max(1000, 'Description must be less than 1000 characters'),
    difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
    timeLimit: z.number()
      .min(30, 'Time limit must be at least 30 seconds')
      .max(1800, 'Time limit must be less than 30 minutes'),
    memoryLimit: z.number()
      .min(64, 'Memory limit must be at least 64MB')
      .max(512, 'Memory limit must be less than 512MB'),
    testCases: z.array(z.object({
      input: z.string().max(1000, 'Test case input too long'),
      expectedOutput: z.string().max(1000, 'Test case output too long'),
      isHidden: z.boolean().default(false)
    })).min(1, 'At least one test case is required')
      .max(20, 'Too many test cases (max 20)'),
    starterCode: z.record(z.string()).optional(),
    languageConfig: z.record(z.object({
      enabled: z.boolean(),
      starterCode: z.string().optional()
    })).optional()
  }),

  // Leaderboard query
  leaderboardQuery: z.object({
    type: z.enum(['season', 'alltime', 'weekly']),
    page: z.coerce.number().min(1).max(1000).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
    search: z.string().max(50, 'Search query too long').optional()
  }),

  // User profile update
  updateProfile: z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be less than 20 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
      .optional(),
    email: z.string()
      .email('Invalid email format')
      .max(100, 'Email must be less than 100 characters')
      .optional(),
    bio: z.string()
      .max(500, 'Bio must be less than 500 characters')
      .optional(),
    avatar: z.string()
      .url('Invalid avatar URL')
      .max(500, 'Avatar URL too long')
      .optional()
  }),

  // Room creation
  createRoom: z.object({
    puzzleId: z.string().uuid('Invalid puzzle ID'),
    isPrivate: z.boolean().default(false),
    maxPlayers: z.number().min(2).max(4).default(2),
    timeLimit: z.number().min(30).max(1800).optional()
  }),

  // Chat message
  chatMessage: z.object({
    message: z.string()
      .min(1, 'Message cannot be empty')
      .max(500, 'Message too long (max 500 characters)')
      .refine((msg) => !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(msg), {
        message: 'Message contains potentially dangerous content'
      })
  })
};

// Validation middleware factory
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize request body against NoSQL injection
      if (req.body) {
        req.body = mongoSanitize(req.body);
      }

      // Validate against schema
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        res.status(400).json({
          error: 'Validation failed',
          errors
        });
        return;
      }

      // Replace request body with validated data
      req.body = result.data;
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({ error: 'Validation error' });
    }
  };
};

// Query parameter validation
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize query parameters
      if (req.query) {
        req.query = mongoSanitize(req.query);
      }

      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        res.status(400).json({
          error: 'Query validation failed',
          errors
        });
        return;
      }

      req.query = result.data;
      next();
    } catch (error) {
      console.error('Query validation error:', error);
      res.status(500).json({ error: 'Query validation error' });
    }
  };
};

// Custom sanitization functions
export const sanitizeHtml = (input: string): string => {
  // Basic HTML sanitization (in production, use DOMPurify)
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

// Rate limiting validation
export const validateRateLimit = (maxPerMinute: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const userRequests = requests.get(key);

    if (!userRequests || now > userRequests.resetTime) {
      requests.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
      return next();
    }

    if (userRequests.count >= maxPerMinute) {
      const retryAfter = Math.ceil((userRequests.resetTime - now) / 1000);
      res.status(429).json({
        error: 'Too many requests',
        retryAfter
      });
      return;
    }

    userRequests.count++;
    next();
  };
};

// Content type validation
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      res.status(415).json({
        error: 'Unsupported media type',
        allowedTypes
      });
      return;
    }

    next();
  };
};

// File upload validation
export const validateFileUpload = (maxSize: number, allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const file = req.file;
    
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (file.size > maxSize) {
      res.status(413).json({ 
        error: 'File too large',
        maxSize: `${maxSize / 1024 / 1024}MB`
      });
      return;
    }

    if (!allowedTypes.includes(file.mimetype)) {
      res.status(415).json({
        error: 'Unsupported file type',
        allowedTypes
      });
      return;
    }

    // Sanitize filename
    file.originalname = sanitizeFilename(file.originalname);
    next();
  };
};

// Error handling for validation
export const handleValidationError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error.name === 'ZodError') {
    const errors = error.errors.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message
    }));
    
    res.status(400).json({
      error: 'Validation failed',
      errors
    });
    return;
  }

  next(error);
};
