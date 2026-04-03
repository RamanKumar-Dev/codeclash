"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = exports.requireAdmin = exports.SuspiciousActivityMonitor = void 0;
exports.validateRequest = validateRequest;
exports.sanitizeCodeMiddleware = sanitizeCodeMiddleware;
exports.xssProtection = xssProtection;
exports.suspiciousActivityMiddleware = suspiciousActivityMiddleware;
exports.verifyJWT = verifyJWT;
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
exports.contentSecurityCheck = contentSecurityCheck;
exports.requestSizeLimiter = requestSizeLimiter;
exports.securityHeaders = securityHeaders;
const zod_1 = require("zod");
const validation_1 = require("../schemas/validation");
// Validation middleware factory
function validateRequest(schema, source = 'body', options = {}) {
    return (req, res, next) => {
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
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: (0, validation_1.formatValidationError)(error),
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
function sanitizeInput(data) {
    if (typeof data === 'string') {
        return (0, validation_1.sanitizeUserInput)(data);
    }
    if (Array.isArray(data)) {
        return data.map(item => sanitizeInput(item));
    }
    if (data && typeof data === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    return data;
}
// Code sanitization middleware
function sanitizeCodeMiddleware(req, res, next) {
    if (req.body.code) {
        req.body.code = (0, validation_1.sanitizeCode)(req.body.code);
    }
    next();
}
// XSS protection middleware
function xssProtection(req, res, next) {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' ws: wss:;");
    next();
}
// IP-based rate limiting for suspicious activity
class SuspiciousActivityMonitor {
    constructor() {
        this.suspiciousIPs = new Set();
        this.ipAttempts = new Map();
        this.MAX_ATTEMPTS = 10;
        this.WINDOW_MS = 5 * 60 * 1000; // 5 minutes
    }
    isSuspicious(ip) {
        return this.suspiciousIPs.has(ip);
    }
    recordAttempt(ip) {
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
    clearSuspicious(ip) {
        this.suspiciousIPs.delete(ip);
        this.ipAttempts.delete(ip);
    }
}
exports.SuspiciousActivityMonitor = SuspiciousActivityMonitor;
// Suspicious activity middleware
const activityMonitor = new SuspiciousActivityMonitor();
function suspiciousActivityMiddleware(req, res, next) {
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
function verifyJWT(token) {
    const jwt = require('jsonwebtoken');
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    }
    catch (error) {
        throw new Error('Invalid token');
    }
}
// Authentication middleware with JWT
function authenticateToken(req, res, next) {
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
    }
    catch (error) {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        activityMonitor.recordAttempt(ip);
        return res.status(403).json({
            error: 'Invalid token',
            message: 'Authentication failed',
        });
    }
}
// Role-based access control
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !('role' in req.user) || !roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                message: 'Required role not found',
            });
        }
        next();
    };
}
// Admin role middleware
exports.requireAdmin = requireRole(['admin']);
// Content security middleware
function contentSecurityCheck(req, res, next) {
    // Check for malicious patterns in request
    const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /eval\s*\(/gi,
        /exec\s*\(/gi,
    ];
    const checkString = (str) => {
        return suspiciousPatterns.some(pattern => pattern.test(str));
    };
    const checkObject = (obj) => {
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
function requestSizeLimiter(maxSize = 10 * 1024 * 1024) {
    return (req, res, next) => {
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
exports.corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
};
// Security headers middleware
function securityHeaders(req, res, next) {
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
//# sourceMappingURL=security.js.map