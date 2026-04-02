import { Router, Request, Response } from 'express';
import { UserService } from '../services/userService';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// Get leaderboard
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const leaderboard = await UserService.getLeaderboard(limit);
    
    // Add rank to each user
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      ...user,
      winRate: user.wins + user.losses > 0 
        ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
        : '0.0'
    }));

    res.json(rankedLeaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get user stats
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await UserService.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stats = {
      ...user,
      winRate: user.wins + user.losses > 0 
        ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
        : '0.0'
    };

    res.json(stats);
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

export default router;
