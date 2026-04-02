import express from 'express';
import { prisma } from '../index';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/match/history
router.get('/history', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }]
      },
      include: {
        player1: { select: { username: true } },
        player2: { select: { username: true } },
        winner: { select: { username: true } },
        problem: { select: { title: true, difficulty: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    const total = await prisma.match.count({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }]
      }
    });

    res.json({
      matches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/match/:id
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const matchId = req.params.id;
    const userId = req.user!.id;

    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ player1Id: userId }, { player2Id: userId }]
      },
      include: {
        player1: { select: { username: true } },
        player2: { select: { username: true } },
        winner: { select: { username: true } },
        problem: true,
        submissions: {
          include: {
            user: { select: { username: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!match) {
      return next(createError('Match not found', 404));
    }

    res.json(match);
  } catch (error) {
    next(error);
  }
});

export default router;
