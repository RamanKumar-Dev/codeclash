"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthSchema = exports.JoinRoomSchema = exports.BattleReadySchema = exports.SpellCastSchema = exports.BattleSubmitSchema = exports.QueueJoinSchema = void 0;
exports.verifyJWT = verifyJWT;
exports.generateJWT = generateJWT;
exports.validateInput = validateInput;
exports.sanitizeInput = sanitizeInput;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
function verifyJWT(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        return decoded;
    }
    catch (error) {
        throw new Error('Invalid JWT token');
    }
}
function generateJWT(payload) {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}
// Zod schemas for input validation
exports.QueueJoinSchema = zod_1.z.object({
    elo: zod_1.z.number().min(0).max(3000),
});
exports.BattleSubmitSchema = zod_1.z.object({
    roomId: zod_1.z.string().uuid(),
    puzzleId: zod_1.z.string().uuid(),
    code: zod_1.z.string().max(10000),
    language: zod_1.z.enum(['python', 'javascript', 'java', 'cpp']),
});
exports.SpellCastSchema = zod_1.z.object({
    roomId: zod_1.z.string().uuid(),
    spellId: zod_1.z.string().uuid(),
    targetUserId: zod_1.z.string().uuid().optional(),
});
exports.BattleReadySchema = zod_1.z.object({
    roomId: zod_1.z.string().uuid(),
});
exports.JoinRoomSchema = zod_1.z.object({
    roomId: zod_1.z.string().uuid(),
});
exports.AuthSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    userId: zod_1.z.string().uuid().optional(),
});
function validateInput(schema, data) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
        }
        throw error;
    }
}
function sanitizeInput(input) {
    return input
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
}
//# sourceMappingURL=validation.js.map