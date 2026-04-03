import express from 'express';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { generateTokens } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { Router } from 'express';

const router: Router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return next(createError(error.details[0].message, 400));
    }

    const { username, email, password } = value;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return next(createError('User with this email or username already exists', 409));
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
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
    await prisma.spell.createMany({
      data: [
        { userId: user.id, type: 'HINT', usesRemaining: 3 },
        { userId: user.id, type: 'TIME_FREEZE', usesRemaining: 2 },
        { userId: user.id, type: 'SLOW', usesRemaining: 1 }
      ]
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    res.status(201).json({
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return next(createError(error.details[0].message, 400));
    }

    const { email, password } = value;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return next(createError('Invalid credentials', 401));
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return next(createError('Invalid credentials', 401));
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

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
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return next(createError('Refresh token required', 400));
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!) as { userId: string };
    
    const user = await prisma.user.findUnique({
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
      return next(createError('User not found', 401));
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);

    res.json({
      user,
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    next(createError('Invalid refresh token', 401));
  }
});

export default router;
