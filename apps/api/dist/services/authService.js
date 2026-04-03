"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
exports.authRateLimit = authRateLimit;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
class AuthService {
    constructor(redis) {
        this.ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
        this.REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
        this.RATE_LIMIT_WINDOW = 5 * 60; // 5 minutes
        this.RATE_LIMIT_MAX = 5; // 5 requests per window
        this.redis = redis;
    }
    // Generate access and refresh tokens
    async generateTokens(user) {
        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
        };
        const accessToken = jsonwebtoken_1.default.sign({ ...payload, tokenType: 'access' }, process.env.JWT_SECRET, { expiresIn: `${this.ACCESS_TOKEN_TTL}s` });
        const refreshToken = jsonwebtoken_1.default.sign({ ...payload, tokenType: 'refresh' }, process.env.JWT_REFRESH_SECRET, { expiresIn: `${this.REFRESH_TOKEN_TTL}s` });
        // Store refresh token in Redis for revocation capability
        await this.redis.setEx(`refresh_token:${user.id}:${refreshToken.slice(-8)}`, this.REFRESH_TOKEN_TTL, refreshToken);
        return { accessToken, refreshToken };
    }
    // Verify access token
    async verifyAccessToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            if (payload.tokenType !== 'access') {
                throw new Error('Invalid token type');
            }
            return payload;
        }
        catch (error) {
            throw new Error('Invalid access token');
        }
    }
    // Verify refresh token and generate new access token
    async refreshAccessToken(refreshToken) {
        try {
            const payload = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            if (payload.tokenType !== 'refresh') {
                throw new Error('Invalid token type');
            }
            // Check if refresh token exists in Redis
            const storedToken = await this.redis.get(`refresh_token:${payload.userId}:${refreshToken.slice(-8)}`);
            if (!storedToken || storedToken !== refreshToken) {
                throw new Error('Refresh token revoked');
            }
            // Generate new access token
            const newPayload = {
                userId: payload.userId,
                username: payload.username,
                role: payload.role,
            };
            return jsonwebtoken_1.default.sign({ ...newPayload, tokenType: 'access' }, process.env.JWT_SECRET, { expiresIn: `${this.ACCESS_TOKEN_TTL}s` });
        }
        catch (error) {
            throw new Error('Invalid refresh token');
        }
    }
    // Revoke refresh token
    async revokeRefreshToken(userId, refreshToken) {
        await this.redis.del(`refresh_token:${userId}:${refreshToken.slice(-8)}`);
    }
    // Revoke all refresh tokens for user
    async revokeAllRefreshTokens(userId) {
        const pattern = `refresh_token:${userId}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
            await this.redis.del(keys);
        }
    }
    // Hash password
    async hashPassword(password) {
        return bcryptjs_1.default.hash(password, 12);
    }
    // Verify password
    async verifyPassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    // Generate verification token
    generateVerificationToken() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    // Generate password reset token
    generatePasswordResetToken() {
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        return { token, expires };
    }
    // Redis-based rate limiting for auth endpoints
    async checkRateLimit(identifier, ip) {
        const key = `rate_limit:auth:${identifier}:${ip}`;
        const current = await this.redis.incr(key);
        if (current === 1) {
            await this.redis.expire(key, this.RATE_LIMIT_WINDOW);
        }
        const ttl = await this.redis.ttl(key);
        const resetTime = Date.now() + (ttl * 1000);
        return {
            allowed: current <= this.RATE_LIMIT_MAX,
            remaining: Math.max(0, this.RATE_LIMIT_MAX - current),
            resetTime,
        };
    }
    // Email verification
    async sendVerificationEmail(user) {
        const token = this.generateVerificationToken();
        // Store token in Redis
        await this.redis.setEx(`email_verification:${user.id}`, 24 * 60 * 60, // 24 hours
        token);
        // TODO: Integrate with email service
        console.log(`Verification email sent to ${user.email} with token ${token}`);
    }
    // Verify email
    async verifyEmail(userId, token) {
        const storedToken = await this.redis.get(`email_verification:${userId}`);
        if (!storedToken || storedToken !== token) {
            return false;
        }
        await this.redis.del(`email_verification:${userId}`);
        return true;
    }
    // Password reset
    async sendPasswordResetEmail(user) {
        const { token, expires } = this.generatePasswordResetToken();
        // Store token in Redis
        await this.redis.setEx(`password_reset:${user.id}`, 10 * 60, // 10 minutes
        JSON.stringify({ token, expires: expires.toISOString() }));
        // TODO: Integrate with email service
        console.log(`Password reset email sent to ${user.email} with token ${token}`);
    }
    // Verify password reset token
    async verifyPasswordResetToken(userId, token) {
        const stored = await this.redis.get(`password_reset:${userId}`);
        if (!stored) {
            return false;
        }
        const { token: storedToken, expires } = JSON.parse(stored);
        if (storedToken !== token || new Date() > new Date(expires)) {
            return false;
        }
        return true;
    }
    // Clear password reset token
    async clearPasswordResetToken(userId) {
        await this.redis.del(`password_reset:${userId}`);
    }
}
exports.AuthService = AuthService;
// Middleware for JWT authentication
function authenticateToken(authService) {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({ error: 'Access token required' });
            }
            const payload = await authService.verifyAccessToken(token);
            req.user = payload;
            next();
        }
        catch (error) {
            return res.status(401).json({ error: 'Invalid access token' });
        }
    };
}
// Middleware for role-based access
function requireRole(requiredRole) {
    return (req, res, next) => {
        const user = req.user;
        if (!user || (user.role !== requiredRole && user.role !== 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
// Rate limiting middleware
function authRateLimit(authService) {
    return async (req, res, next) => {
        const identifier = req.body.username || req.body.email || req.ip;
        const ip = req.ip;
        const rateLimit = await authService.checkRateLimit(identifier, ip);
        res.set({
            'X-RateLimit-Limit': authService['RATE_LIMIT_MAX'],
            'X-RateLimit-Remaining': rateLimit.remaining,
            'X-RateLimit-Reset': rateLimit.resetTime,
        });
        if (!rateLimit.allowed) {
            return res.status(429).json({
                error: 'Too many requests',
                resetTime: rateLimit.resetTime
            });
        }
        next();
    };
}
//# sourceMappingURL=authService.js.map