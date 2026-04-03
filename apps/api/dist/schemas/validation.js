"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitConfigSchema = exports.WSAuthSchema = exports.WSPayloadSchema = exports.UserUpdateSchema = exports.PuzzleUpdateSchema = exports.PuzzleCreateSchema = exports.ExecutionRequestSchema = exports.SpellCastSchema = exports.BattleSubmitSchema = exports.QueueJoinSchema = exports.RegisterSchema = exports.LoginSchema = void 0;
exports.formatValidationError = formatValidationError;
exports.sanitizeCode = sanitizeCode;
exports.sanitizeUserInput = sanitizeUserInput;
const zod_1 = require("zod");
// User authentication schemas
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.RegisterSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters'),
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase, one uppercase, and one number'),
});
// Battle schemas
exports.QueueJoinSchema = zod_1.z.object({
    elo: zod_1.z.number().int('ELO must be an integer').min(0, 'ELO must be positive').max(5000, 'ELO cannot exceed 5000'),
});
exports.BattleSubmitSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Code cannot be empty').max(100000, 'Code cannot exceed 100KB'),
    language: zod_1.z.enum(['python', 'javascript', 'cpp', 'java', 'go']),
    roomId: zod_1.z.string().uuid('Invalid room ID'),
});
exports.SpellCastSchema = zod_1.z.object({
    spellType: zod_1.z.enum(['HEAL', 'DAMAGE', 'SHIELD', 'TIME_FREEZE', 'HINT', 'SLOW']),
    roomId: zod_1.z.string().uuid('Invalid room ID'),
});
// Judge service schemas
exports.ExecutionRequestSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Code cannot be empty').max(100000, 'Code cannot exceed 100KB'),
    language: zod_1.z.enum(['python', 'javascript', 'cpp', 'java', 'go']),
    puzzleId: zod_1.z.string().uuid('Invalid puzzle ID'),
    userId: zod_1.z.string().uuid('Invalid user ID'),
    roomId: zod_1.z.string().uuid('Invalid room ID'),
    submissionId: zod_1.z.string().uuid('Invalid submission ID').optional(),
});
// Puzzle management schemas
exports.PuzzleCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title cannot exceed 100 characters'),
    description: zod_1.z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description cannot exceed 2000 characters'),
    difficulty: zod_1.z.enum(['EASY', 'MEDIUM', 'HARD']),
    timeLimitMs: zod_1.z.number().int('Time limit must be an integer').min(30000, 'Time limit must be at least 30 seconds').max(600000, 'Time limit cannot exceed 10 minutes'),
    testCases: zod_1.z.array(zod_1.z.object({
        input: zod_1.z.string().max(1000, 'Test input cannot exceed 1000 characters'),
        expectedOutput: zod_1.z.string().max(1000, 'Expected output cannot exceed 1000 characters'),
        description: zod_1.z.string().max(200, 'Test description cannot exceed 200 characters').optional(),
    })).min(1, 'At least one test case is required').max(20, 'Cannot exceed 20 test cases'),
});
exports.PuzzleUpdateSchema = exports.PuzzleCreateSchema.partial();
// Admin schemas
exports.UserUpdateSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters').optional(),
    email: zod_1.z.string().email('Invalid email format').optional(),
    rank: zod_1.z.number().int('ELO must be an integer').min(0, 'ELO must be positive').max(5000, 'ELO cannot exceed 5000').optional(),
    banned: zod_1.z.boolean().optional(),
});
// WebSocket payload schemas
exports.WSPayloadSchema = zod_1.z.object({
    event: zod_1.z.string(),
    data: zod_1.z.unknown(),
});
exports.WSAuthSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
    userId: zod_1.z.string().uuid('Invalid user ID'),
});
// Rate limiting schemas
exports.RateLimitConfigSchema = zod_1.z.object({
    windowMs: zod_1.z.number().int('Window must be in milliseconds').positive(),
    maxRequests: zod_1.z.number().int('Max requests must be positive'),
    message: zod_1.z.string().optional(),
});
// Validation error formatter
function formatValidationError(error) {
    return error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
}
// Sanitization helpers
function sanitizeCode(code) {
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
function sanitizeUserInput(input) {
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
}
//# sourceMappingURL=validation.js.map