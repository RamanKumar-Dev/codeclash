"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const prisma_1 = require("../lib/prisma");
class AuthMiddleware {
    // Generate JWT token
    static generateToken(user) {
        const payload = {
            userId: user.id,
            username: user.username,
            email: user.email,
        };
        return jsonwebtoken_1.default.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
    }
    // Verify JWT token
    static verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, this.JWT_SECRET);
    }
    // Hash password
    static async hashPassword(password) {
        return bcryptjs_1.default.hash(password, 10);
    }
    // Verify password
    static async verifyPassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    // Register endpoint
    static async register(req, res, next) {
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
            const existingUser = await prisma_1.prisma.user.findFirst({
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
            const hashedPassword = await _a.hashPassword(password);
            const newUser = await prisma_1.prisma.user.create({
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
            const token = _a.generateToken(newUser);
            res.status(201).json({
                user: newUser,
                token,
            });
        }
        catch (error) {
            console.error('Registration error:', error);
            next(error);
        }
    }
    // Login endpoint
    static async login(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password required' });
            }
            // Find user by email
            const user = await prisma_1.prisma.user.findUnique({
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
            const isValid = await _a.verifyPassword(password, user.passwordHash);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            // Remove password hash from response
            const { passwordHash, ...userWithoutPassword } = user;
            const token = _a.generateToken(userWithoutPassword);
            res.json({
                user: userWithoutPassword,
                token,
            });
        }
        catch (error) {
            console.error('Login error:', error);
            next(error);
        }
    }
    // Get profile endpoint
    static async getProfile(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const user = await prisma_1.prisma.user.findUnique({
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
        }
        catch (error) {
            console.error('Get profile error:', error);
            next(error);
        }
    }
}
exports.AuthMiddleware = AuthMiddleware;
_a = AuthMiddleware;
AuthMiddleware.JWT_SECRET = process.env.JWT_SECRET || 'mvp-secret-key';
AuthMiddleware.JWT_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds
// Rate limiting for auth endpoints
AuthMiddleware.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
// Authentication middleware
AuthMiddleware.authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        const payload = _a.verifyToken(token);
        // Attach user info to request
        req.user = {
            id: payload.userId,
            username: payload.username,
            email: payload.email,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
//# sourceMappingURL=auth.js.map