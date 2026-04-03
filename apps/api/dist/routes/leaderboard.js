"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const redis_1 = require("redis");
const index_1 = require("../index");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
const redis = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redis.on('error', (err) => console.log('Redis Client Error', err));
// Connect to Redis
redis.connect().catch(console.error);
// GET /api/leaderboard
router.get('/', async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const season = req.query.season || 'global';
        const userId = req.query.userId;
        const leaderboardKey = `leaderboard:${season}`;
        // Get top players
        const topPlayers = await redis.zrevrangeWithScores(leaderboardKey, 0, limit - 1);
        // Get user rank if userId provided
        let userRank = null;
        if (userId) {
            const rank = await redis.zrevrank(leaderboardKey, userId);
            if (rank !== null) {
                const userScore = await redis.zscore(leaderboardKey, userId);
                const user = await index_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: { username: true }
                });
                if (user && userScore !== null) {
                    userRank = {
                        userId,
                        username: user.username,
                        xp: Math.floor(userScore),
                        rank: rank + 1
                    };
                }
            }
        }
        // Format leaderboard entries
        const entries = await Promise.all(topPlayers.map(async (player, index) => {
            const user = await index_1.prisma.user.findUnique({
                where: { id: player.value },
                select: { username: true }
            });
            return {
                userId: player.value,
                username: user?.username || 'Unknown',
                xp: Math.floor(player.score),
                rank: index + 1
            };
        }));
        res.json({
            entries,
            userRank,
            season,
            total: await redis.zcard(leaderboardKey)
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/leaderboard/update
router.post('/update', async (req, res, next) => {
    try {
        const { userId, xp, season = 'global' } = req.body;
        if (!userId || typeof xp !== 'number') {
            return next((0, errorHandler_1.createError)('userId and xp are required', 400));
        }
        const leaderboardKey = `leaderboard:${season}`;
        await redis.zadd(leaderboardKey, xp, userId);
        res.json({ success: true, message: 'Leaderboard updated' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=leaderboard.js.map