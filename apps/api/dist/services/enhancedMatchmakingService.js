"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedMatchmakingService = void 0;
class EnhancedMatchmakingService {
    constructor(redis, prisma, io, options) {
        // Default configuration
        this.DEFAULT_OPTIONS = {
            initialEloWindow: 100,
            maxEloWindow: 500,
            windowExpansionInterval: 10000, // 10 seconds
            windowExpansionAmount: 50,
            maxWaitTime: 300000, // 5 minutes
            battleTimeout: 30000, // 30 seconds
        };
        this.redis = redis;
        this.prisma = prisma;
        this.io = io;
        this.options = { ...this.DEFAULT_OPTIONS, ...options };
    }
    // Add user to matchmaking queue with proper ELO window tracking
    async addToQueue(userId, socketId, elo) {
        const queueKey = 'matchmaking:queue';
        const userKey = `matchmaking:user:${userId}`;
        // Store user data with initial ELO window and join time
        const userData = {
            userId,
            socketId,
            elo,
            joinTime: Date.now(),
            currentEloWindow: this.options.initialEloWindow,
            expansions: 0,
        };
        await Promise.all([
            this.redis.zAdd(queueKey, { score: elo, value: userId }),
            this.redis.hSet(userKey, {
                ...userData,
                joinTime: userData.joinTime.toString(),
                currentEloWindow: userData.currentEloWindow.toString(),
                expansions: userData.expansions.toString(),
            }),
            this.redis.expire(userKey, Math.ceil(this.options.maxWaitTime / 1000)),
        ]);
        console.log(`User ${userId} (${elo}) joined matchmaking queue`);
        this.notifyQueueSize();
    }
    // Remove user from queue
    async removeFromQueue(userId) {
        const queueKey = 'matchmaking:queue';
        const userKey = `matchmaking:user:${userId}`;
        await Promise.all([
            this.redis.zRem(queueKey, userId),
            this.redis.del(userKey),
        ]);
        console.log(`User ${userId} left matchmaking queue`);
        this.notifyQueueSize();
    }
    // Enhanced matchmaking with ELO window expansion and error handling
    async findMatch() {
        const queueKey = 'matchmaking:queue';
        // Get all users in queue
        const queuedUsers = await this.redis.zRange(queueKey, 0, -1, { REV: true });
        if (queuedUsers.length < 2) {
            return null;
        }
        // Try to find matches for each user
        for (const userId of queuedUsers) {
            const userData = await this.redis.hGetAll(`matchmaking:user:${userId}`);
            if (!userData.userId)
                continue;
            const userElo = parseInt(userData.elo);
            const currentWindow = parseInt(userData.currentEloWindow || this.options.initialEloWindow);
            const joinTime = parseInt(userData.joinTime);
            // Check if user has waited too long
            if (Date.now() - joinTime > this.options.maxWaitTime) {
                await this.removeFromQueue(userId);
                this.notifyTimeout(userId, userData.socketId);
                continue;
            }
            // Find opponent within ELO window
            const minElo = Math.max(0, userElo - currentWindow);
            const maxElo = userElo + currentWindow;
            const opponents = await this.redis.zRangeByScore(queueKey, minElo, maxElo);
            // Filter out self and already matched users
            const validOpponents = opponents.filter(id => id !== userId && queuedUsers.includes(id));
            if (validOpponents.length > 0) {
                // Choose closest ELO opponent
                let bestMatch = validOpponents[0];
                let bestDistance = Math.abs(parseInt(await this.redis.hGet(`matchmaking:user:${bestMatch}`, 'elo') || '0') - userElo);
                for (const opponent of validOpponents) {
                    const opponentElo = parseInt(await this.redis.hGet(`matchmaking:user:${opponent}`, 'elo') || '0');
                    const distance = Math.abs(opponentElo - userElo);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestMatch = opponent;
                    }
                }
                // Remove both players from queue
                await Promise.all([
                    this.removeFromQueue(userId),
                    this.removeFromQueue(bestMatch),
                ]);
                return { player1: userId, player2: bestMatch };
            }
        }
        return null;
    }
    // ELO window expansion with proper capping
    async expandEloWindows() {
        const queueKey = 'matchmaking:queue';
        const queuedUsers = await this.redis.zRange(queueKey, 0, -1);
        for (const userId of queuedUsers) {
            const userKey = `matchmaking:user:${userId}`;
            const userData = await this.redis.hGetAll(userKey);
            if (!userData.userId)
                continue;
            const currentWindow = parseInt(userData.currentEloWindow || this.options.initialEloWindow);
            const expansions = parseInt(userData.expansions || '0');
            // Don't expand beyond max window
            if (currentWindow >= this.options.maxEloWindow) {
                continue;
            }
            const newWindow = Math.min(currentWindow + this.options.windowExpansionAmount, this.options.maxEloWindow);
            const newExpansions = expansions + 1;
            await this.redis.hSet(userKey, {
                currentEloWindow: newWindow.toString(),
                expansions: newExpansions.toString(),
            });
            console.log(`Expanded ELO window for ${userId}: ${currentWindow} -> ${newWindow}`);
        }
    }
    // Start matchmaking service with proper error handling
    async startMatchmaking() {
        console.log('Starting enhanced matchmaking service...');
        // Matchmaking interval
        const matchmakingInterval = setInterval(async () => {
            try {
                const match = await this.findMatch();
                if (match) {
                    await this.createBattle(match.player1, match.player2);
                }
            }
            catch (error) {
                console.error('Matchmaking error:', error);
            }
        }, 2000); // Check every 2 seconds
        // ELO window expansion interval
        const expansionInterval = setInterval(async () => {
            try {
                await this.expandEloWindows();
            }
            catch (error) {
                console.error('ELO window expansion error:', error);
            }
        }, this.options.windowExpansionInterval);
        // Cleanup on process exit
        process.on('SIGTERM', () => {
            clearInterval(matchmakingInterval);
            clearInterval(expansionInterval);
        });
    }
    // Create battle with proper error states and puzzle versioning
    async createBattle(player1Id, player2Id) {
        try {
            const roomId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // Get player data
            const [player1, player2] = await Promise.all([
                this.prisma.user.findUnique({ where: { id: player1Id } }),
                this.prisma.user.findUnique({ where: { id: player2Id } }),
            ]);
            if (!player1 || !player2) {
                throw new Error('Player not found');
            }
            // Select puzzle (avoid repeats for each player)
            const puzzle = await this.selectPuzzle(player1Id, player2Id);
            // Create battle record
            const battle = await this.prisma.battle.create({
                data: {
                    roomId,
                    player1Id,
                    player2Id,
                    puzzleId: puzzle.id,
                    puzzleVersion: puzzle.version,
                    status: 'WAITING',
                    player1Hp: 100,
                    player2Hp: 100,
                    lastActivityAt: new Date(),
                },
            });
            // Store battle state in Redis with proper TTL
            const battleState = {
                ...battle,
                puzzle,
                player1: {
                    id: player1.id,
                    username: player1.username,
                    elo: player1.elo,
                },
                player2: {
                    id: player2.id,
                    username: player2.username,
                    elo: player2.elo,
                },
                status: 'WAITING',
                startTime: null,
                lastActivity: Date.now(),
            };
            await this.redis.setEx(`battle:${roomId}`, 1800, JSON.stringify(battleState)); // 30 minutes
            // Notify players
            await Promise.all([
                this.notifyPlayerMatch(player1.socketId || '', roomId, battleState),
                this.notifyPlayerMatch(player2.socketId || '', roomId, battleState),
            ]);
            console.log(`Battle created: ${roomId} between ${player1.username} and ${player2.username}`);
        }
        catch (error) {
            console.error('Error creating battle:', error);
            // Put players back in queue or notify them of error
            await Promise.all([
                this.notifyError(player1Id, 'Failed to create battle'),
                this.notifyError(player2Id, 'Failed to create battle'),
            ]);
        }
    }
    // Enhanced puzzle selection with repeat prevention
    async selectPuzzle(player1Id, player2Id) {
        const difficulty = this.getMatchDifficulty(player1Id, player2Id);
        // Get recent puzzles for both players (last 5 battles)
        const recentPuzzleIds = await this.getRecentPuzzles(player1Id, player2Id);
        // Find suitable puzzle excluding recent ones
        const puzzle = await this.prisma.puzzle.findFirst({
            where: {
                difficulty,
                isActive: true,
                id: { notIn: recentPuzzleIds },
            },
            orderBy: { submissionCount: 'asc' }, // Prefer less used puzzles
        });
        if (!puzzle) {
            // Fallback to any puzzle if no suitable one found
            return this.prisma.puzzle.findFirst({
                where: { difficulty, isActive: true },
            });
        }
        return puzzle;
    }
    getMatchDifficulty(player1Id, player2Id) {
        // Calculate average ELO and determine difficulty
        // This would need actual ELO data from database
        return 'medium'; // Placeholder
    }
    async getRecentPuzzles(player1Id, player2Id) {
        // Get puzzle IDs from last 5 battles for each player
        const [recent1, recent2] = await Promise.all([
            this.prisma.battle.findMany({
                where: { OR: [{ player1Id }, { player2Id }] },
                select: { puzzleId: true },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
        ]);
        const recentIds = [...recent1, ...recent2].map(b => b.puzzleId);
        return [...new Set(recentIds)]; // Remove duplicates
    }
    // Notification methods
    async notifyQueueSize() {
        const size = await this.getQueueSize();
        this.io.emit('queue:size_update', { size });
    }
    async notifyPlayerMatch(socketId, roomId, battleState) {
        this.io.to(socketId).emit('battle:found', { roomId, battleState });
    }
    async notifyTimeout(userId, socketId) {
        this.io.to(socketId).emit('queue:timeout', { message: 'Matchmaking timeout' });
    }
    async notifyError(userId, message) {
        // This would need socket lookup by userId
        console.error(`Error for user ${userId}: ${message}`);
    }
    // Get current queue size
    async getQueueSize() {
        return this.redis.zCard('matchmaking:queue');
    }
    // Cleanup expired queue entries
    async cleanupExpired() {
        const queueKey = 'matchmaking:queue';
        const queuedUsers = await this.redis.zRange(queueKey, 0, -1);
        const now = Date.now();
        for (const userId of queuedUsers) {
            const userData = await this.redis.hGetAll(`matchmaking:user:${userId}`);
            if (!userData.userId)
                continue;
            const joinTime = parseInt(userData.joinTime);
            if (now - joinTime > this.options.maxWaitTime) {
                await this.removeFromQueue(userId);
                this.notifyTimeout(userId, userData.socketId);
            }
        }
    }
}
exports.EnhancedMatchmakingService = EnhancedMatchmakingService;
//# sourceMappingURL=enhancedMatchmakingService.js.map