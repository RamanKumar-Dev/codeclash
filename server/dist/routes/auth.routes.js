"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// Register
router.post('/register', auth_1.AuthMiddleware.rateLimiter, auth_1.AuthMiddleware.register);
// Login
router.post('/login', auth_1.AuthMiddleware.rateLimiter, auth_1.AuthMiddleware.login);
// Get profile
router.get('/profile', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.getProfile);
// Update profile (placeholder for future features)
router.put('/profile', auth_1.AuthMiddleware.authenticate, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { username } = req.body;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // For MVP, only allow username updates
        if (!username) {
            return res.status(400).json({ error: 'Username required' });
        }
        // Check if username is already taken
        const existingUser = await prisma_1.prisma.user.findFirst({
            where: {
                username,
                NOT: { id: userId }
            }
        });
        if (existingUser) {
            return res.status(409).json({ error: 'Username already taken' });
        }
        const updatedUser = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { username },
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
        res.json({ user: updatedUser });
    }
    catch (error) {
        console.error('Update profile error:', error);
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map