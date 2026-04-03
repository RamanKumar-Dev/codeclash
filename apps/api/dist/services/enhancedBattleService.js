"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedBattleService = void 0;
class EnhancedBattleService {
    constructor(redis, prisma, io) {
        this.DISCONNECT_TIMEOUT = 30000; // 30 seconds
        this.CODE_PROGRESS_DEBOUNCE = 500; // 500ms
        this.COUNTDOWN_DURATION = 3000; // 3 seconds
        this.redis = redis;
        this.prisma = prisma;
        this.io = io;
    }
    // Enhanced battle state management
    async updateBattleState(roomId, updates) {
        const battleKey = `battle:${roomId}`;
        try {
            // Get current state
            const currentState = await this.getBattleState(roomId);
            if (!currentState) {
                throw new Error('Battle not found');
            }
            // Validate state transitions
            if (updates.status && !this.isValidStateTransition(currentState.status, updates.status)) {
                throw new Error(`Invalid state transition: ${currentState.status} -> ${updates.status}`);
            }
            // Apply updates
            const newState = { ...currentState, ...updates, lastActivity: Date.now() };
            // Save to Redis
            await this.redis.setEx(battleKey, 1800, JSON.stringify(newState)); // 30 minutes TTL
            // Broadcast state change
            await this.broadcastStateChange(roomId, newState);
            return newState;
        }
        catch (error) {
            console.error('Error updating battle state:', error);
            throw error;
        }
    }
    // State machine validation
    isValidStateTransition(currentStatus, newStatus) {
        const validTransitions = {
            'WAITING': ['COUNTDOWN', 'ERROR', 'ABANDONED'],
            'COUNTDOWN': ['ACTIVE', 'ERROR', 'ABANDONED'],
            'ACTIVE': ['JUDGING', 'COMPLETED', 'ERROR', 'ABANDONED'],
            'JUDGING': ['ACTIVE', 'COMPLETED', 'ERROR'],
            'COMPLETED': [], // Terminal state
            'ERROR': ['ABANDONED'], // Can only go to abandoned from error
            'ABANDONED': [], // Terminal state
        };
        return validTransitions[currentStatus]?.includes(newStatus) || false;
    }
    // Get battle state with error handling
    async getBattleState(roomId) {
        try {
            const battleKey = `battle:${roomId}`;
            const stateJson = await this.redis.get(battleKey);
            if (!stateJson) {
                return null;
            }
            const state = JSON.parse(stateJson);
            // Validate state integrity
            if (!this.isValidBattleState(state)) {
                console.error(`Invalid battle state for room ${roomId}`);
                await this.redis.del(battleKey);
                return null;
            }
            return state;
        }
        catch (error) {
            console.error('Error getting battle state:', error);
            return null;
        }
    }
    isValidBattleState(state) {
        return (state.id &&
            state.roomId &&
            state.player1Id &&
            state.player2Id &&
            state.status &&
            state.player1 &&
            state.player2 &&
            ['WAITING', 'COUNTDOWN', 'ACTIVE', 'JUDGING', 'COMPLETED', 'ERROR', 'ABANDONED'].includes(state.status));
    }
    // Enhanced countdown with server synchronization
    async startCountdown(roomId) {
        const battleState = await this.getBattleState(roomId);
        if (!battleState || battleState.status !== 'WAITING') {
            return;
        }
        const countdownStartTime = Date.now();
        await this.updateBattleState(roomId, {
            status: 'COUNTDOWN',
            countdownStartTime,
        });
        // Broadcast countdown start with server timestamp
        this.io.to(roomId).emit('battle:countdown_start', {
            startTime: countdownStartTime,
            duration: this.COUNTDOWN_DURATION,
            serverTime: Date.now(),
        });
        // Schedule battle start
        setTimeout(async () => {
            try {
                const currentState = await this.getBattleState(roomId);
                if (currentState && currentState.status === 'COUNTDOWN') {
                    await this.startBattle(roomId);
                }
            }
            catch (error) {
                console.error('Error starting battle after countdown:', error);
                await this.updateBattleState(roomId, {
                    status: 'ERROR',
                    errorReason: 'Failed to start battle',
                });
            }
        }, this.COUNTDOWN_DURATION);
    }
    // Start battle with proper state management
    async startBattle(roomId) {
        const battleState = await this.getBattleState(roomId);
        if (!battleState) {
            return;
        }
        await this.updateBattleState(roomId, {
            status: 'ACTIVE',
            startTime: Date.now(),
        });
        // Broadcast battle start
        this.io.to(roomId).emit('battle:start', {
            timeLimit: battleState.timeLimit,
            startTime: Date.now(),
            puzzle: battleState.puzzle,
        });
        // Schedule battle timeout
        setTimeout(async () => {
            try {
                const currentState = await this.getBattleState(roomId);
                if (currentState && currentState.status === 'ACTIVE') {
                    await this.endBattle(roomId, 'TIMEOUT');
                }
            }
            catch (error) {
                console.error('Error handling battle timeout:', error);
            }
        }, battleState.timeLimit * 1000);
    }
    // Handle code progress with debouncing
    async handleCodeProgress(socket, data) {
        const userId = socket.userId;
        const roomId = socket.roomId;
        if (!userId || !roomId)
            return;
        const battleState = await this.getBattleState(roomId);
        if (!battleState || battleState.status !== 'ACTIVE') {
            return;
        }
        // Determine which player
        const isPlayer1 = battleState.player1Id === userId;
        const playerKey = isPlayer1 ? 'player1' : 'player2';
        // Debounce progress updates
        const progressKey = `battle:progress:${roomId}:${userId}`;
        const lastUpdate = await this.redis.get(progressKey);
        const now = Date.now();
        if (lastUpdate && (now - parseInt(lastUpdate)) < this.CODE_PROGRESS_DEBOUNCE) {
            return; // Skip update due to debounce
        }
        // Update progress
        await this.redis.setEx(progressKey, 1, now.toString());
        const updates = {
            [playerKey]: {
                ...battleState[playerKey],
                code: data.code,
                progress: data.progress,
                lastActivity: now,
            },
        };
        await this.updateBattleState(roomId, updates);
        // Broadcast progress to opponent (not the sender)
        socket.to(roomId).emit('battle:opponent_progress', {
            userId,
            progress: data.progress,
            timestamp: now,
        });
    }
    // Enhanced disconnect handling
    async handleDisconnect(socket) {
        const userId = socket.userId;
        const roomId = socket.roomId;
        if (!userId || !roomId)
            return;
        console.log(`User ${userId} disconnected from room ${roomId}`);
        const battleState = await this.getBattleState(roomId);
        if (!battleState)
            return;
        // Mark player as disconnected
        const isPlayer1 = battleState.player1Id === userId;
        const playerKey = isPlayer1 ? 'player1' : 'player2';
        await this.updateBattleState(roomId, {
            [playerKey]: {
                ...battleState[playerKey],
                lastActivity: Date.now(),
            },
        });
        // Start disconnect timeout
        const disconnectKey = `battle:disconnect:${roomId}:${userId}`;
        await this.redis.setEx(disconnectKey, this.DISCONNECT_TIMEOUT / 1000, Date.now().toString());
        // Check if other player is already disconnected
        const otherPlayerId = isPlayer1 ? battleState.player2Id : battleState.player1Id;
        const otherDisconnectKey = `battle:disconnect:${roomId}:${otherPlayerId}`;
        const otherDisconnectTime = await this.redis.get(otherDisconnectKey);
        if (otherDisconnectTime) {
            // Both players disconnected, abandon battle
            await this.updateBattleState(roomId, {
                status: 'ABANDONED',
                errorReason: 'Both players disconnected',
            });
            // Clean up disconnect keys
            await Promise.all([
                this.redis.del(disconnectKey),
                this.redis.del(otherDisconnectKey),
            ]);
        }
        else {
            // Notify opponent of disconnection
            socket.to(roomId).emit('battle:opponent_disconnected', {
                userId,
                timeout: this.DISCONNECT_TIMEOUT,
            });
        }
    }
    // Handle reconnection
    async handleReconnection(socket, roomId) {
        const userId = socket.userId;
        if (!userId || !roomId)
            return;
        console.log(`User ${userId} reconnected to room ${roomId}`);
        // Clear disconnect timeout
        const disconnectKey = `battle:disconnect:${roomId}:${userId}`;
        await this.redis.del(disconnectKey);
        const battleState = await this.getBattleState(roomId);
        if (!battleState)
            return;
        // Restore player state from Redis
        const isPlayer1 = battleState.player1Id === userId;
        const playerKey = isPlayer1 ? 'player1' : 'player2';
        // Send current battle state to reconnected player
        socket.emit('battle:state_restore', battleState);
        // Notify opponent of reconnection
        socket.to(roomId).emit('battle:opponent_reconnected', { userId });
    }
    // Enhanced battle ending
    async endBattle(roomId, reason) {
        const battleState = await this.getBattleState(roomId);
        if (!battleState)
            return;
        const endTime = Date.now();
        let winnerId;
        let status;
        switch (reason) {
            case 'VICTORY':
                winnerId = battleState.player1.hp > 0 ? battleState.player1Id : battleState.player2Id;
                status = 'COMPLETED';
                break;
            case 'TIMEOUT':
                // Determine winner by remaining HP
                if (battleState.player1.hp > battleState.player2.hp) {
                    winnerId = battleState.player1Id;
                }
                else if (battleState.player2.hp > battleState.player1.hp) {
                    winnerId = battleState.player2Id;
                }
                status = 'COMPLETED';
                break;
            case 'ABANDONED':
                status = 'ABANDONED';
                break;
        }
        await this.updateBattleState(roomId, {
            status,
            endTime,
            winnerId,
        });
        // Update database
        await this.updateBattleDatabase(roomId, status, winnerId);
        // Broadcast battle end
        this.io.to(roomId).emit('battle:end', {
            reason,
            winnerId,
            finalState: battleState,
        });
        // Clean up Redis data
        await this.cleanupBattleData(roomId);
    }
    async updateBattleDatabase(roomId, status, winnerId) {
        try {
            await this.prisma.battle.update({
                where: { roomId },
                data: {
                    status,
                    winnerId,
                    endTime: new Date(),
                },
            });
        }
        catch (error) {
            console.error('Error updating battle database:', error);
        }
    }
    async cleanupBattleData(roomId) {
        const patterns = [
            `battle:${roomId}`,
            `battle:progress:${roomId}:*`,
            `battle:disconnect:${roomId}:*`,
            `battle:first_solve:${roomId}`,
        ];
        for (const pattern of patterns) {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
        }
    }
    // Broadcast state change to room
    async broadcastStateChange(roomId, state) {
        this.io.to(roomId).emit('battle:state_update', {
            status: state.status,
            player1Hp: state.player1.hp,
            player2Hp: state.player2.hp,
            player1Progress: state.player1.progress,
            player2Progress: state.player2.progress,
            currentRound: state.currentRound,
            timeRemaining: this.calculateTimeRemaining(state),
        });
    }
    calculateTimeRemaining(state) {
        if (!state.startTime || state.status !== 'ACTIVE') {
            return state.timeLimit;
        }
        const elapsed = (Date.now() - state.startTime) / 1000;
        return Math.max(0, state.timeLimit - elapsed);
    }
    // Handle Judge0 failures
    async handleJudge0Failure(roomId, userId, error) {
        const battleState = await this.getBattleState(roomId);
        if (!battleState)
            return;
        console.error(`Judge0 failure for user ${userId} in room ${roomId}:`, error);
        // Set battle to error state
        await this.updateBattleState(roomId, {
            status: 'ERROR',
            errorReason: `Judge0 execution failed: ${error}`,
        });
        // Notify players
        this.io.to(roomId).emit('battle:error', {
            message: 'Code execution service temporarily unavailable',
            canRetry: true,
        });
    }
    // Periodic cleanup of expired battles
    async cleanupExpiredBattles() {
        const battleKeys = await this.redis.keys('battle:*');
        const now = Date.now();
        for (const key of battleKeys) {
            try {
                const state = await this.redis.get(key);
                if (!state)
                    continue;
                const battleState = JSON.parse(state);
                const lastActivity = battleState.lastActivity || 0;
                // Clean up battles inactive for more than 1 hour
                if (now - lastActivity > 3600000) {
                    await this.cleanupBattleData(battleState.roomId);
                    console.log(`Cleaned up expired battle: ${battleState.roomId}`);
                }
            }
            catch (error) {
                console.error('Error cleaning up battle:', error);
            }
        }
    }
}
exports.EnhancedBattleService = EnhancedBattleService;
//# sourceMappingURL=enhancedBattleService.js.map