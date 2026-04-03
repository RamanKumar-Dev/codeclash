"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const joi_1 = __importDefault(require("joi"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
// Validation schemas
const registerSchema = joi_1.default.object({
    username: joi_1.default.string().alphanum().min(3).max(30).required(),
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(6).required()
});
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required()
});
// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return next((0, errorHandler_1.createError)(error.details[0].message, 400));
        }
        const { username, email, password } = value;
        // Check if user already exists
        const existingUser = await index_1.prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }]
            }
        });
        if (existingUser) {
            return next((0, errorHandler_1.createError)('User with this email or username already exists', 409));
        }
        // Hash password
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        // Create user
        const user = await index_1.prisma.user.create({
            data: {
                username,
                email,
                passwordHash,
                xp: 0,
                rank: 1000,
                tokens: 100
            },
            select: {
                id: true,
                username: true,
                email: true,
                xp: true,
                rank: true,
                tokens: true,
                createdAt: true
            }
        });
        // Generate initial spells for user
        await index_1.prisma.spell.createMany({
            data: [
                { userId: user.id, type: 'HINT', usesRemaining: 3 },
                { userId: user.id, type: 'TIME_FREEZE', usesRemaining: 2 },
                { userId: user.id, type: 'SLOW', usesRemaining: 1 }
            ]
        });
        // Generate tokens
        const { accessToken, refreshToken } = (0, auth_1.generateTokens)(user.id);
        res.status(201).json({
            user,
            accessToken,
            refreshToken
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return next((0, errorHandler_1.createError)(error.details[0].message, 400));
        }
        const { email, password } = value;
        // Find user
        const user = await index_1.prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return next((0, errorHandler_1.createError)('Invalid credentials', 401));
        }
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValidPassword) {
            return next((0, errorHandler_1.createError)('Invalid credentials', 401));
        }
        // Generate tokens
        const { accessToken, refreshToken } = (0, auth_1.generateTokens)(user.id);
        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            xp: user.xp,
            rank: user.rank,
            tokens: user.tokens,
            createdAt: user.createdAt
        };
        res.json({
            user: userResponse,
            accessToken,
            refreshToken
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return next((0, errorHandler_1.createError)('Refresh token required', 400));
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        const user = await index_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                username: true,
                email: true,
                xp: true,
                rank: true,
                tokens: true
            }
        });
        if (!user) {
            return next((0, errorHandler_1.createError)('User not found', 401));
        }
        const { accessToken, refreshToken: newRefreshToken } = (0, auth_1.generateTokens)(user.id);
        res.json({
            user,
            accessToken,
            refreshToken: newRefreshToken
        });
    }
    catch (error) {
        next((0, errorHandler_1.createError)('Invalid refresh token', 401));
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map