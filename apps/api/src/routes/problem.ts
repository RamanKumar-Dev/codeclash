import express from 'express';
import { prisma } from '../index';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// GET /api/problems
router.get('/', async (req, res, next) => {
  try {
    const difficulty = req.query.difficulty as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const where = difficulty ? { difficulty: difficulty.toUpperCase() } : {};

    const problems = await prisma.problem.findMany({
      where,
      select: {
        id: true,
        title: true,
        difficulty: true,
        tags: true,
        timeLimitMs: true,
        memoryLimitMb: true
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    const total = await prisma.problem.count({ where });

    res.json({
      problems,
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

// GET /api/problems/:id
router.get('/:id', async (req, res, next) => {
  try {
    const problemId = req.params.id;

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        timeLimitMs: true,
        memoryLimitMb: true,
        tags: true
      }
    });

    if (!problem) {
      return next(createError('Problem not found', 404));
    }

    res.json(problem);
  } catch (error) {
    next(error);
  }
});

export default router;
