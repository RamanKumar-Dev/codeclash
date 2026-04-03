"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeasonalSystem = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
class SeasonalSystem {
    constructor(redis, prisma) {
        this.currentSeason = null;
        this.redis = redis;
        this.prisma = prisma;
    }
    // Initialize seasonal system
    async initialize() {
        // Load current season
        await this.loadCurrentSeason();
        // Schedule periodic tasks
        this.scheduleSeasonalTasks();
        console.log('Seasonal system initialized');
    }
    // Load current active season
    async loadCurrentSeason() {
        try {
            const now = new Date();
            this.currentSeason = await this.prisma.season.findFirst({
                where: {
                    isActive: true,
                    startDate: { lte: now },
                    endDate: { gte: now },
                },
                orderBy: { startDate: 'desc' },
            });
            if (this.currentSeason) {
                console.log(`Current season: ${this.currentSeason.name}`);
            }
            else {
                console.log('No active season found');
            }
        }
        catch (error) {
            console.error('Error loading current season:', error);
        }
    }
    // Create new season
    async createSeason(config) {
        try {
            // Validate dates
            if (config.startDate >= config.endDate) {
                throw new Error('Start date must be before end date');
            }
            // Deactivate previous seasons
            await this.prisma.season.updateMany({
                where: { isActive: true },
                data: { isActive: false },
            });
            // Create new season
            const season = await this.prisma.season.create({
                data: {
                    name: config.name,
                    startDate: config.startDate,
                    endDate: config.endDate,
                    isActive: config.isActive,
                },
            });
            // Update current season
            if (config.isActive) {
                this.currentSeason = season;
            }
            console.log(`Created season: ${season.name}`);
            return season;
        }
        catch (error) {
            console.error('Error creating season:', error);
            throw error;
        }
    }
    // Record ELO history snapshot
    async recordEloSnapshot(userId, battleId) {
        if (!this.currentSeason)
            return;
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { seasonElo: true },
            });
            if (!user)
                return;
            await this.prisma.eloHistory.create({
                data: {
                    userId,
                    seasonId: this.currentSeason.id,
                    elo: user.seasonElo,
                    timestamp: new Date(),
                    battleId,
                },
            });
            // Cache in Redis for performance
            const historyKey = `elo_history:${userId}:${this.currentSeason.id}`;
            await this.redis.lPush(historyKey, JSON.stringify({
                elo: user.seasonElo,
                timestamp: Date.now(),
                battleId,
            }));
            // Keep only last 100 entries
            await this.redis.lTrim(historyKey, 0, 99);
            await this.redis.expire(historyKey, 86400 * 30); // 30 days TTL
        }
        catch (error) {
            console.error('Error recording ELO snapshot:', error);
        }
    }
    // Get user's ELO history for current season
    async getEloHistory(userId) {
        if (!this.currentSeason)
            return [];
        try {
            // Try Redis cache first
            const historyKey = `elo_history:${userId}:${this.currentSeason.id}`;
            const cachedHistory = await this.redis.lRange(historyKey, 0, -1);
            if (cachedHistory.length > 0) {
                return cachedHistory.map(entry => JSON.parse(entry));
            }
            // Fallback to database
            const history = await this.prisma.eloHistory.findMany({
                where: {
                    userId,
                    seasonId: this.currentSeason.id,
                },
                orderBy: { timestamp: 'asc' },
            });
            // Cache results
            for (const entry of history) {
                await this.redis.lPush(historyKey, JSON.stringify(entry));
            }
            await this.redis.expire(historyKey, 86400 * 30);
            return history;
        }
        catch (error) {
            console.error('Error getting ELO history:', error);
            return [];
        }
    }
    // Update seasonal ELO
    async updateSeasonalElo(userId, newElo) {
        try {
            await this.prisma.user.update({
                where: { id: userId },
                data: { seasonElo: newElo },
            });
            // Update seasonal leaderboard
            await this.updateSeasonalLeaderboard(userId, newElo);
        }
        catch (error) {
            console.error('Error updating seasonal ELO:', error);
        }
    }
    // Update seasonal leaderboard
    async updateSeasonalLeaderboard(userId, elo) {
        if (!this.currentSeason)
            return;
        const leaderboardKey = `leaderboard:season:${this.currentSeason.id}`;
        try {
            await this.redis.zAdd(leaderboardKey, { score: elo, value: userId });
            await this.redis.expire(leaderboardKey, 86400 * 7); // 7 days TTL
        }
        catch (error) {
            console.error('Error updating seasonal leaderboard:', error);
        }
    }
    // Get seasonal leaderboard
    async getSeasonalLeaderboard(limit = 100) {
        if (!this.currentSeason)
            return [];
        try {
            const leaderboardKey = `leaderboard:season:${this.currentSeason.id}`;
            const topPlayers = await this.redis.zRevRangeWithScores(leaderboardKey, 0, limit - 1);
            // Get user details
            const userIds = topPlayers.map(entry => entry.value);
            const users = await this.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, username: true, seasonElo: true },
            });
            // Combine results
            return topPlayers.map((entry, index) => {
                const user = users.find(u => u.id === entry.value);
                return {
                    rank: index + 1,
                    userId: entry.value,
                    username: user?.username || 'Unknown',
                    elo: entry.score,
                };
            });
        }
        catch (error) {
            console.error('Error getting seasonal leaderboard:', error);
            return [];
        }
    }
    // End season and award badges
    async endSeason(seasonId) {
        try {
            const season = await this.prisma.season.findUnique({
                where: { id: seasonId },
            });
            if (!season) {
                throw new Error('Season not found');
            }
            console.log(`Ending season: ${season.name}`);
            // Get top 10 players
            const leaderboard = await this.getSeasonalLeaderboard(10);
            // Award badges to top 10
            for (let i = 0; i < leaderboard.length; i++) {
                const player = leaderboard[i];
                const badgeType = i < 3 ? 'gold' : i < 6 ? 'silver' : 'bronze';
                await this.prisma.seasonBadge.create({
                    data: {
                        userId: player.userId,
                        seasonId: season.id,
                        rank: player.rank,
                        badgeType,
                        awardedAt: new Date(),
                    },
                });
                console.log(`Awarded ${badgeType} badge to ${player.username} (rank ${player.rank})`);
            }
            // Reset seasonal ELO for all users
            await this.resetSeasonalElo();
            // Deactivate season
            await this.prisma.season.update({
                where: { id: seasonId },
                data: { isActive: false },
            });
            // Clear seasonal data from Redis
            await this.clearSeasonalData(seasonId);
            console.log(`Season ${season.name} ended successfully`);
        }
        catch (error) {
            console.error('Error ending season:', error);
            throw error;
        }
    }
    // Reset seasonal ELO for all users
    async resetSeasonalElo() {
        try {
            await this.prisma.user.updateMany({
                data: { seasonElo: 1000 }, // Reset to base ELO
            });
            console.log('Reset seasonal ELO for all users');
        }
        catch (error) {
            console.error('Error resetting seasonal ELO:', error);
        }
    }
    // Apply ELO decay for inactive players
    async applyEloDecay() {
        if (!this.currentSeason)
            return;
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const inactiveUsers = await this.prisma.user.findMany({
                where: {
                    lastActiveAt: { lt: thirtyDaysAgo },
                },
                select: { id: true, seasonElo: true },
            });
            for (const user of inactiveUsers) {
                // Apply 5% ELO decay per month of inactivity
                const decayedElo = Math.floor(user.seasonElo * 0.95);
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { seasonElo: decayedElo },
                });
                await this.updateSeasonalLeaderboard(user.id, decayedElo);
            }
            if (inactiveUsers.length > 0) {
                console.log(`Applied ELO decay to ${inactiveUsers.length} inactive users`);
            }
        }
        catch (error) {
            console.error('Error applying ELO decay:', error);
        }
    }
    // Clear seasonal data from Redis
    async clearSeasonalData(seasonId) {
        const patterns = [
            `leaderboard:season:${seasonId}`,
            `elo_history:*:${seasonId}`,
        ];
        for (const pattern of patterns) {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
        }
    }
    // Schedule seasonal tasks
    scheduleSeasonalTasks() {
        // Weekly leaderboard reset (Monday 00:00 UTC)
        node_cron_1.default.schedule('0 0 * * 1', async () => {
            console.log('Running weekly leaderboard reset');
            await this.resetWeeklyLeaderboard();
        });
        // Monthly ELO decay check (1st of each month)
        node_cron_1.default.schedule('0 0 1 * *', async () => {
            console.log('Running monthly ELO decay');
            await this.applyEloDecay();
        });
        // Season end check (hourly)
        node_cron_1.default.schedule('0 * * * *', async () => {
            await this.checkSeasonEnd();
        });
        console.log('Seasonal tasks scheduled');
    }
    // Reset weekly leaderboard
    async resetWeeklyLeaderboard() {
        if (!this.currentSeason)
            return;
        try {
            const weeklyKey = `leaderboard:weekly:${this.currentSeason.id}`;
            await this.redis.del(weeklyKey);
            console.log('Weekly leaderboard reset');
        }
        catch (error) {
            console.error('Error resetting weekly leaderboard:', error);
        }
    }
    // Check if season should end
    async checkSeasonEnd() {
        if (!this.currentSeason)
            return;
        const now = new Date();
        if (now >= this.currentSeason.endDate) {
            console.log(`Season ${this.currentSeason.name} has ended`);
            await this.endSeason(this.currentSeason.id);
            await this.loadCurrentSeason();
        }
    }
    // Get user's seasonal badges
    async getUserSeasonalBadges(userId) {
        try {
            return await this.prisma.seasonBadge.findMany({
                where: { userId },
                include: {
                    season: {
                        select: { name: true },
                    },
                },
                orderBy: { awardedAt: 'desc' },
            });
        }
        catch (error) {
            console.error('Error getting user seasonal badges:', error);
            return [];
        }
    }
    // Get current season info
    getCurrentSeason() {
        return this.currentSeason;
    }
    // Update user's last activity (for ELO decay)
    async updateUserActivity(userId) {
        try {
            await this.prisma.user.update({
                where: { id: userId },
                data: { lastActiveAt: new Date() },
            });
        }
        catch (error) {
            console.error('Error updating user activity:', error);
        }
    }
}
exports.SeasonalSystem = SeasonalSystem;
//# sourceMappingURL=seasonalSystem.js.map