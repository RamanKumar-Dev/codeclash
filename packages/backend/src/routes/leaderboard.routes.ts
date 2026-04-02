import { Router } from 'express';
import { LeaderboardService } from '../services/leaderboard.service';
import { SeasonService } from '../services/season.service';
import { UserService } from '../services/user.service';
import { redisService } from '../services/redis.service';
import { LeaderboardQuery } from '@code-clash/shared-types';

const router = Router();

// Initialize services
const userService = new UserService();
const leaderboardService = new LeaderboardService(redisService, userService);
const seasonService = new SeasonService(redisService, leaderboardService, userService);

// GET /leaderboard
router.get('/', async (req, res, next) => {
  try {
    const { 
      type = 'season', 
      page = 1, 
      limit = 50, 
      search 
    } = req.query as LeaderboardQuery;

    const currentUserId = req.user?.id; // Assuming auth middleware adds user

    const leaderboard = await leaderboardService.getLeaderboard({
      type,
      page: Number(page),
      limit: Number(limit),
      search
    }, currentUserId);

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /leaderboard/rank/:userId
router.get('/rank/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { type = 'season', seasonId } = req.query;

    const userRank = await leaderboardService.getUserRank(userId, type as string, seasonId as string);

    if (!userRank) {
      return res.status(404).json({ error: 'User not found in leaderboard' });
    }

    res.json(userRank);
  } catch (error) {
    console.error('Error fetching user rank:', error);
    res.status(500).json({ error: 'Failed to fetch user rank' });
  }
});

// GET /leaderboard/season
router.get('/season', async (req, res, next) => {
  try {
    const currentSeason = await seasonService.getCurrentSeason();
    
    if (!currentSeason) {
      return res.status(404).json({ error: 'No active season found' });
    }

    res.json(currentSeason);
  } catch (error) {
    console.error('Error fetching current season:', error);
    res.status(500).json({ error: 'Failed to fetch current season' });
  }
});

// GET /leaderboard/season/history
router.get('/season/history', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    
    const seasonHistory = await seasonService.getSeasonHistory(Number(limit));
    
    res.json(seasonHistory);
  } catch (error) {
    console.error('Error fetching season history:', error);
    res.status(500).json({ error: 'Failed to fetch season history' });
  }
});

// GET /leaderboard/season/summary/:userId
router.get('/season/summary/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { seasonId } = req.query;

    if (!seasonId) {
      return res.status(400).json({ error: 'Season ID is required' });
    }

    const seasonSummary = await seasonService.getSeasonSummary(userId, seasonId as string);
    
    res.json(seasonSummary);
  } catch (error) {
    console.error('Error fetching season summary:', error);
    res.status(500).json({ error: 'Failed to fetch season summary' });
  }
});

// GET /leaderboard/time-until-season-end
router.get('/time-until-season-end', async (req, res, next) => {
  try {
    const timeUntilEnd = await seasonService.getTimeUntilSeasonEnd();
    
    if (!timeUntilEnd) {
      return res.status(404).json({ error: 'No active season found' });
    }

    res.json(timeUntilEnd);
  } catch (error) {
    console.error('Error fetching time until season end:', error);
    res.status(500).json({ error: 'Failed to fetch time until season end' });
  }
});

// GET /leaderboard/search
router.get('/search', async (req, res, next) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchResults = await leaderboardService.searchUsers(query, Number(limit));
    
    res.json(searchResults);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// GET /leaderboard/rank-distribution
router.get('/rank-distribution', async (req, res, next) => {
  try {
    const distribution = await leaderboardService.getRankDistribution();
    
    res.json(distribution);
  } catch (error) {
    console.error('Error fetching rank distribution:', error);
    res.status(500).json({ error: 'Failed to fetch rank distribution' });
  }
});

// POST /leaderboard/season/create (Admin only)
router.post('/season/create', async (req, res, next) => {
  try {
    const { name, durationDays } = req.body;

    const newSeason = await seasonService.createSeason(name, durationDays);
    
    res.json(newSeason);
  } catch (error) {
    console.error('Error creating season:', error);
    res.status(500).json({ error: 'Failed to create season' });
  }
});

// POST /leaderboard/season/end/:seasonId (Admin only)
router.post('/season/end/:seasonId', async (req, res, next) => {
  try {
    const { seasonId } = req.params;

    await seasonService.endSeason(seasonId);
    
    res.json({ success: true, message: 'Season ended successfully' });
  } catch (error) {
    console.error('Error ending season:', error);
    res.status(500).json({ error: 'Failed to end season' });
  }
});

export default router;
