import jwt from 'jsonwebtoken';
import { z } from 'zod';

export interface JwtPayload {
  userId: string;
  username: string;
  elo: number;
  iat?: number;
  exp?: number;
}

export function verifyJWT(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid JWT token');
  }
}

export function generateJWT(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

// Zod schemas for input validation
export const QueueJoinSchema = z.object({
  elo: z.number().min(0).max(3000),
});

export const BattleSubmitSchema = z.object({
  roomId: z.string().uuid(),
  puzzleId: z.string().uuid(),
  code: z.string().max(10000),
  language: z.enum(['python', 'javascript', 'java', 'cpp']),
});

export const SpellCastSchema = z.object({
  roomId: z.string().uuid(),
  spellId: z.string().uuid(),
  targetUserId: z.string().uuid().optional(),
});

export const BattleReadySchema = z.object({
  roomId: z.string().uuid(),
});

export const JoinRoomSchema = z.object({
  roomId: z.string().uuid(),
});

export const AuthSchema = z.object({
  token: z.string().min(1),
  userId: z.string().uuid().optional(),
});

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}
