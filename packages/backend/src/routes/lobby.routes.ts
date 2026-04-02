import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { friendService } from '../services/friend.service';
import { privateRoomService } from '../services/private-room.service';
import { spectatorService } from '../services/spectator.service';
import { matchmakingService } from '../services/matchmaking.service';
import { BattleRoom } from '../models/battle.model';
import { User } from '../models/user.model';
import { 
  LobbyStats, 
  RecentBattle, 
  NewsItem,
  PrivateRoomRequest 
} from '@code-clash/shared-types';

const router = Router();

// GET /api/lobby/stats - Get lobby statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    // Get various statistics
    const [queueSize, onlineUsers, activeBattles, featuredBattle] = await Promise.all([
      matchmakingService.getQueueSize(),
      User.countDocuments({ isOnline: true }),
      BattleRoom.countDocuments({ state: 'ACTIVE' }),
      spectatorService.getFeaturedBattle(),
    ]);

    const stats: LobbyStats = {
      activeBattles,
      onlineUsers,
      queueSize,
      featuredBattle: featuredBattle || undefined,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting lobby stats:', error);
    res.status(500).json({ error: 'Failed to get lobby statistics' });
  }
});

// GET /api/lobby/recent-battles - Get user's recent battles
router.get('/recent-battles', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 10;

    // Get recent battles from database
    const recentBattles = await BattleRoom.findBattleHistory(userId, limit);
    
    const formattedBattles: RecentBattle[] = recentBattles.map(battle => {
      const isPlayer1 = battle.player1Id === userId;
      const opponent = isPlayer1 ? battle.player2Id : battle.player1Id;
      const opponentUser = isPlayer1 ? battle.player1Id : battle.player2Id;
      
      return {
        id: battle.id,
        opponentUsername: opponentUser?.username || 'Unknown',
        opponentElo: opponentUser?.elo || 1200,
        result: battle.winnerId === userId ? 'win' : 'loss',
        eloChange: 0, // Would calculate from battle stats
        puzzleTitle: battle.puzzleId || 'Unknown',
        duration: battle.endedAt && battle.startedAt ? 
          battle.endedAt.getTime() - battle.startedAt.getTime() : 0,
        completedAt: battle.endedAt || new Date(),
      };
    });

    res.json(formattedBattles);
  } catch (error) {
    console.error('Error getting recent battles:', error);
    res.status(500).json({ error: 'Failed to get recent battles' });
  }
});

// GET /api/lobby/news - Get news items
router.get('/news', async (req: Request, res: Response) => {
  try {
    // Mock news data - in production this would come from a database
    const news: NewsItem[] = [
      {
        id: '1',
        title: 'Season 3 Starts Now!',
        content: 'Compete for exclusive rewards and climb the leaderboard in our biggest season yet.',
        type: 'season',
        priority: 'high',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        actionUrl: '/season/3',
      },
      {
        id: '2',
        title: 'New Puzzle Pack Released',
        content: '20 challenging algorithms puzzles added to the pool. Test your skills!',
        type: 'feature',
        priority: 'medium',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      {
        id: '3',
        title: 'Weekend Tournament',
        content: 'Join the weekend tournament for double XP and special prizes.',
        type: 'event',
        priority: 'medium',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        actionUrl: '/tournament/weekend',
      },
    ];

    res.json(news.filter(item => item.isActive));
  } catch (error) {
    console.error('Error getting news:', error);
    res.status(500).json({ error: 'Failed to get news' });
  }
});

// GET /api/lobby/friends/online - Get online friends
router.get('/friends/online', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const onlineFriends = await friendService.getOnlineFriends(userId);
    
    res.json(onlineFriends);
  } catch (error) {
    console.error('Error getting online friends:', error);
    res.status(500).json({ error: 'Failed to get online friends' });
  }
});

// POST /api/lobby/friends/request/:username - Send friend request
router.post('/friends/request/:username', authenticateToken, async (req: Request, res: Response) => {
  try {
    const fromUserId = (req as any).user.id;
    const toUsername = req.params.username;

    const friendRequest = await friendService.sendFriendRequest(fromUserId, toUsername);
    
    res.json(friendRequest);
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/lobby/friends/accept/:userId - Accept friend request
router.post('/friends/accept/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const fromUserId = req.params.userId;

    const friend = await friendService.acceptFriendRequest(userId, fromUserId);
    
    res.json(friend);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/lobby/friends/decline/:userId - Decline friend request
router.post('/friends/decline/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const fromUserId = req.params.userId;

    await friendService.declineFriendRequest(userId, fromUserId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error declining friend request:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// DELETE /api/lobby/friends/remove/:userId - Remove friend
router.delete('/friends/remove/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const friendUserId = req.params.userId;

    await friendService.removeFriend(userId, friendUserId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/lobby/friends/pending - Get pending friend requests
router.get('/friends/pending', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const pendingRequests = await friendService.getPendingRequests(userId);
    
    res.json(pendingRequests);
  } catch (error) {
    console.error('Error getting pending requests:', error);
    res.status(500).json({ error: 'Failed to get pending requests' });
  }
});

// GET /api/lobby/friends/search - Search for users
router.get('/friends/search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user.id;
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const users = await friendService.searchUsers(query, currentUserId, limit);
    
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// GET /api/lobby/friends/suggestions - Get friend suggestions
router.get('/friends/suggestions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const suggestions = await friendService.getFriendSuggestions(userId, limit);
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error getting friend suggestions:', error);
    res.status(500).json({ error: 'Failed to get friend suggestions' });
  }
});

// POST /api/lobby/rooms/private - Create private room
router.post('/rooms/private', authenticateToken, async (req: Request, res: Response) => {
  try {
    const creatorId = (req as any).user.id;
    const creatorUsername = (req as any).user.username;
    const options: PrivateRoomRequest = req.body;

    const room = await privateRoomService.createPrivateRoom(creatorId, creatorUsername, options);
    
    res.json(room);
  } catch (error) {
    console.error('Error creating private room:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/lobby/rooms/join/:roomCode - Join private room
router.post('/rooms/join/:roomCode', authenticateToken, async (req: Request, res: Response) => {
  try {
    const roomCode = req.params.roomCode;
    const guestId = (req as any).user.id;
    const guestUsername = (req as any).user.username;

    const room = await privateRoomService.joinPrivateRoom(roomCode, guestId, guestUsername);
    
    res.json(room);
  } catch (error) {
    console.error('Error joining private room:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/lobby/rooms/:roomId/ready - Set ready status in private room
router.post('/rooms/:roomId/ready', authenticateToken, async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    const userId = (req as any).user.id;

    const room = await privateRoomService.setPlayerReady(roomId, userId);
    
    res.json(room);
  } catch (error) {
    console.error('Error setting ready status:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// DELETE /api/lobby/rooms/:roomId - Leave private room
router.delete('/rooms/:roomId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    const userId = (req as any).user.id;

    await privateRoomService.leavePrivateRoom(roomId, userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving private room:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/lobby/rooms/active - Get user's active private room
router.get('/rooms/active', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const room = await privateRoomService.getUserActiveRoom(userId);
    
    res.json(room);
  } catch (error) {
    console.error('Error getting active room:', error);
    res.status(500).json({ error: 'Failed to get active room' });
  }
});

// GET /api/lobby/battles/live - Get live battles for spectating
router.get('/battles/live', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const liveBattles = await spectatorService.getLiveBattles();
    
    res.json(liveBattles.slice(0, limit));
  } catch (error) {
    console.error('Error getting live battles:', error);
    res.status(500).json({ error: 'Failed to get live battles' });
  }
});

// GET /api/lobby/battles/featured - Get featured battle
router.get('/battles/featured', async (req: Request, res: Response) => {
  try {
    const featuredBattle = await spectatorService.getFeaturedBattle();
    
    res.json(featuredBattle);
  } catch (error) {
    console.error('Error getting featured battle:', error);
    res.status(500).json({ error: 'Failed to get featured battle' });
  }
});

// GET /api/lobby/queue/status - Get queue status
router.get('/queue/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const response = await matchmakingService.getQueueStatus(userId);
    
    if (response.success) {
      res.json({
        queueSize: response.queueSize,
        estimatedWaitTime: response.estimatedWaitTime,
      });
    } else {
      res.status(400).json({ error: response.error });
    }
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// GET /api/lobby/users/search - Search users (general search)
router.get('/users/search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const users = await User.searchUsers(query, limit);
    
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// GET /api/lobby/leaderboard - Get leaderboard
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const friendsOnly = req.query.friends === 'true';
    const userId = (req as any).user?.id;

    let leaderboard;
    
    if (friendsOnly && userId) {
      // Get friends leaderboard
      const friends = await friendService.getUserFriends(userId);
      const friendIds = friends.map(f => f.userId);
      friendIds.push(userId); // Include current user
      
      leaderboard = await User.find({ 
        id: { $in: friendIds },
        isOnline: true 
      })
      .sort({ elo: -1, totalWins: -1 })
      .limit(limit)
      .select('username elo totalWins totalLosses avatarUrl isOnline');
    } else {
      // Get global leaderboard
      leaderboard = await User.findLeaderboard(limit);
    }

    res.json(leaderboard);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

export { router as lobbyRoutes };
