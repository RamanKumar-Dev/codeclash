"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userService_1 = require("../services/userService");
const router = (0, express_1.Router)();
// Get leaderboard
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const leaderboard = await userService_1.UserService.getLeaderboard(limit);
        // Add rank to each user
        const rankedLeaderboard = leaderboard.map((user, index) => ({
            rank: index + 1,
            ...user,
            winRate: user.wins + user.losses > 0
                ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
                : '0.0'
        }));
        res.json(rankedLeaderboard);
    }
    catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});
// Get user stats
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await userService_1.UserService.getUserById(userId);
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
    }
    catch (error) {
        console.error('User stats error:', error);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});
exports.default = router;
//# sourceMappingURL=leaderboard.routes.js.map