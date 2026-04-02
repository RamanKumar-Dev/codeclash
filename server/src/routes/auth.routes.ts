import { Router, Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { UserService } from '../services/userService';
import { prisma } from '../lib/prisma';

const router = Router();

// Register
router.post('/register', AuthMiddleware.rateLimiter, AuthMiddleware.register);

// Login
router.post('/login', AuthMiddleware.rateLimiter, AuthMiddleware.login);

// Get profile
router.get('/profile', AuthMiddleware.authenticate, AuthMiddleware.getProfile);

// Update profile (placeholder for future features)
router.put('/profile', AuthMiddleware.authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { username } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // For MVP, only allow username updates
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    // Check if username is already taken
    const existingUser = await prisma.user.findFirst({
      where: {
        username,
        NOT: { id: userId }
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const updatedUser = await prisma.user.update({
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
  } catch (error) {
    console.error('Update profile error:', error);
    next(error);
  }
});

export default router;
