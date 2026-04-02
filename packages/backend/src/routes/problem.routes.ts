import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { PuzzleService } from '../services/puzzle.service';
import { User } from '../models/user.model';

const router = Router();

// GET /api/problems — list all puzzles (requires auth)
router.get('/', authMiddleware.authenticate, async (req: any, res: Response) => {
  try {
    const user = await User.findOne({ id: req.user.id }).select('elo');
    const userElo = user?.elo ?? 1200;

    const difficulty = req.query.difficulty ? Number(req.query.difficulty) : undefined;

    let puzzles;
    if (difficulty) {
      puzzles = await PuzzleService.getPuzzlesByDifficulty(difficulty);
    } else {
      puzzles = await PuzzleService.getPuzzlesByElo(userElo);
    }

    // Strip hidden test cases from list view
    const safe = puzzles.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      eloRange: p.eloRange,
      tags: p.tags,
      languages: p.languages,
    }));

    return res.json({ puzzles: safe, total: safe.length });
  } catch (err) {
    console.error('List puzzles error:', err);
    return res.status(500).json({ error: 'Failed to fetch puzzles' });
  }
});

// GET /api/problems/:id — get single puzzle (visible test cases only)
router.get('/:id', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const puzzle = await PuzzleService.getPuzzleById(req.params.id);

    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    return res.json({
      puzzle: {
        ...puzzle,
        // Only expose visible test cases
        testCases: puzzle.testCases.filter((tc) => !tc.isHidden),
        hiddenTestCases: undefined,
      },
    });
  } catch (err) {
    console.error('Get puzzle error:', err);
    return res.status(500).json({ error: 'Failed to fetch puzzle' });
  }
});

export default router;
