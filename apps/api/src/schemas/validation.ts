import { z } from 'zod';

// User authentication schemas
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RegisterSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase, one uppercase, and one number'),
});

// Battle schemas
export const QueueJoinSchema = z.object({
  elo: z.number().int('ELO must be an integer').min(0, 'ELO must be positive').max(5000, 'ELO cannot exceed 5000'),
});

export const BattleSubmitSchema = z.object({
  code: z.string().min(1, 'Code cannot be empty').max(100000, 'Code cannot exceed 100KB'),
  language: z.enum(['python', 'javascript', 'cpp', 'java', 'go']),
  roomId: z.string().uuid('Invalid room ID'),
});

export const SpellCastSchema = z.object({
  spellType: z.enum(['HEAL', 'DAMAGE', 'SHIELD', 'TIME_FREEZE', 'HINT', 'SLOW']),
  roomId: z.string().uuid('Invalid room ID'),
});

// Judge service schemas
export const ExecutionRequestSchema = z.object({
  code: z.string().min(1, 'Code cannot be empty').max(100000, 'Code cannot exceed 100KB'),
  language: z.enum(['python', 'javascript', 'cpp', 'java', 'go']),
  puzzleId: z.string().uuid('Invalid puzzle ID'),
  userId: z.string().uuid('Invalid user ID'),
  roomId: z.string().uuid('Invalid room ID'),
  submissionId: z.string().uuid('Invalid submission ID').optional(),
});

// Puzzle management schemas
export const PuzzleCreateSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title cannot exceed 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description cannot exceed 2000 characters'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  timeLimitMs: z.number().int('Time limit must be an integer').min(30000, 'Time limit must be at least 30 seconds').max(600000, 'Time limit cannot exceed 10 minutes'),
  testCases: z.array(z.object({
    input: z.string().max(1000, 'Test input cannot exceed 1000 characters'),
    expectedOutput: z.string().max(1000, 'Expected output cannot exceed 1000 characters'),
    description: z.string().max(200, 'Test description cannot exceed 200 characters').optional(),
  })).min(1, 'At least one test case is required').max(20, 'Cannot exceed 20 test cases'),
});

export const PuzzleUpdateSchema = PuzzleCreateSchema.partial();

// Admin schemas
export const UserUpdateSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters').optional(),
  email: z.string().email('Invalid email format').optional(),
  rank: z.number().int('ELO must be an integer').min(0, 'ELO must be positive').max(5000, 'ELO cannot exceed 5000').optional(),
  banned: z.boolean().optional(),
});

// WebSocket payload schemas
export const WSPayloadSchema = z.object({
  event: z.string(),
  data: z.unknown(),
});

export const WSAuthSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  userId: z.string().uuid('Invalid user ID'),
});

// Rate limiting schemas
export const RateLimitConfigSchema = z.object({
  windowMs: z.number().int('Window must be in milliseconds').positive(),
  maxRequests: z.number().int('Max requests must be positive'),
  message: z.string().optional(),
});

// Export type inference
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type QueueJoinInput = z.infer<typeof QueueJoinSchema>;
export type BattleSubmitInput = z.infer<typeof BattleSubmitSchema>;
export type SpellCastInput = z.infer<typeof SpellCastSchema>;
export type ExecutionRequestInput = z.infer<typeof ExecutionRequestSchema>;
export type PuzzleCreateInput = z.infer<typeof PuzzleCreateSchema>;
export type PuzzleUpdateInput = z.infer<typeof PuzzleUpdateSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
export type WSAuthInput = z.infer<typeof WSAuthSchema>;
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

// Validation error formatter
export function formatValidationError(error: z.ZodError): string {
  return error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
}

// Sanitization helpers
export function sanitizeCode(code: string): string {
  // Remove potentially dangerous patterns while preserving functionality
  const dangerousPatterns = [
    /import\s+os/gi,
    /import\s+subprocess/gi,
    /import\s+sys/gi,
    /from\s+os\s+import/gi,
    /from\s+subprocess\s+import/gi,
    /from\s+sys\s+import/gi,
    /exec\s*\(/gi,
    /eval\s*\(/gi,
    /require\s*\(\s*['"']child_process['"']\s*\)/gi,
    /require\s*\(\s*['"']fs['"']\s*\)/gi,
    /process\s*\.\s*exit/gi,
    /sys\s*\.\s*exit/gi,
  ];

  let sanitized = code;
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '/* BLOCKED */');
  });

  return sanitized;
}

export function sanitizeUserInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}
