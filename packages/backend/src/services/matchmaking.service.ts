import { v4 as uuidv4 } from 'uuid';
import { 
  QueueEntry, 
  MatchmakingRequest, 
  MatchmakingResponse, 
  BattleRoom, 
  BattleParticipant,
  Problem,
  MATCHMAKING_CONFIG 
} from '@code-clash/shared-types';
import { redisService } from './redis.service';
import { battleRoomService } from './battle-room.service';
import { puzzleService } from './puzzle.service';

export class MatchmakingService {
  private scanInterval: NodeJS.Timeout | null = null;
  private eloWindowMultiplier = 1;
  private lastWindowExpansion = Date.now();

  constructor() {
    this.startMatchmakingScan();
  }

  // Queue Management
  async joinQueue(request: MatchmakingRequest): Promise<MatchmakingResponse> {
    try {
      // Check if user is already in queue or battle
      const existingBattle = await redisService.getUserBattleRoom(request.userId);
      if (existingBattle) {
        return {
          success: false,
          error: 'User is already in a battle',
        };
      }

      // Check if user is already in queue
      const queueEntries = await redisService.getQueueEntries();
      const alreadyInQueue = queueEntries.find(entry => entry.userId === request.userId);
      if (alreadyInQueue) {
        return {
          success: false,
          error: 'User is already in queue',
        };
      }

      // Add to queue
      const queueEntry: QueueEntry = {
        userId: request.userId,
        username: '', // Will be filled from user service
        elo: request.elo,
        joinedAt: new Date(),
        preferences: request.preferences || {},
      };

      await redisService.addToQueue(queueEntry);

      const queueSize = await redisService.getQueueSize();
      const estimatedWaitTime = this.calculateEstimatedWaitTime(queueSize, request.elo);

      return {
        success: true,
        queueSize,
        estimatedWaitTime,
      };
    } catch (error) {
      console.error('Error joining queue:', error);
      return {
        success: false,
        error: 'Failed to join queue',
      };
    }
  }

  async leaveQueue(userId: string): Promise<void> {
    try {
      await redisService.removeFromQueue(userId);
    } catch (error) {
      console.error('Error leaving queue:', error);
    }
  }

  async getQueueStatus(userId: string): Promise<MatchmakingResponse> {
    try {
      const queueSize = await redisService.getQueueSize();
      const queueEntries = await redisService.getQueueEntries();
      const userEntry = queueEntries.find(entry => entry.userId === userId);
      
      if (!userEntry) {
        return {
          success: false,
          error: 'User not in queue',
        };
      }

      const estimatedWaitTime = this.calculateEstimatedWaitTime(queueSize, userEntry.elo);

      return {
        success: true,
        queueSize,
        estimatedWaitTime,
      };
    } catch (error) {
      console.error('Error getting queue status:', error);
      return {
        success: false,
        error: 'Failed to get queue status',
      };
    }
  }

  // Matchmaking Algorithm
  private async scanForMatches(): Promise<void> {
    try {
      const queueEntries = await redisService.getQueueEntries();
      
      if (queueEntries.length < 2) return;

      // Sort by join time (FIFO)
      queueEntries.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

      const matchedUsers = new Set<string>();
      const currentEloWindow = MATCHMAKING_CONFIG.INITIAL_ELO_WINDOW * this.eloWindowMultiplier;

      for (let i = 0; i < queueEntries.length && matchedUsers.size < queueEntries.length - 1; i++) {
        const player1 = queueEntries[i];
        
        if (matchedUsers.has(player1.userId)) continue;

        // Find opponent within ELO range
        const opponent = await redisService.findMatch(player1.elo, currentEloWindow);
        
        if (opponent && !matchedUsers.has(opponent.userId) && opponent.userId !== player1.userId) {
          // Check compatibility
          if (this.arePlayersCompatible(player1, opponent)) {
            // Create match
            await this.createMatch(player1, opponent);
            
            // Remove both from queue
            await redisService.removeFromQueue(player1.userId);
            await redisService.removeFromQueue(opponent.userId);
            
            // Mark as matched
            matchedUsers.add(player1.userId);
            matchedUsers.add(opponent.userId);
          }
        }
      }
    } catch (error) {
      console.error('Error scanning for matches:', error);
    }
  }

  private arePlayersCompatible(player1: QueueEntry, player2: QueueEntry): boolean {
    // Check difficulty preferences
    if (player1.preferences.difficulty && player2.preferences.difficulty) {
      if (player1.preferences.difficulty !== player2.preferences.difficulty) {
        return false;
      }
    }

    // Check time limit preferences
    if (player1.preferences.timeLimit && player2.preferences.timeLimit) {
      const diff = Math.abs(player1.preferences.timeLimit - player2.preferences.timeLimit);
      if (diff > 300000) { // 5 minute difference tolerance
        return false;
      }
    }

    // Check language compatibility (at least one common language)
    if (player1.preferences.languages && player2.preferences.languages) {
      const commonLanguages = player1.preferences.languages.filter(
        lang => player2.preferences.languages!.includes(lang)
      );
      if (commonLanguages.length === 0) {
        return false;
      }
    }

    return true;
  }

  private async createMatch(player1: QueueEntry, player2: QueueEntry): Promise<void> {
    try {
      // Select puzzle based on average ELO
      const avgElo = Math.round((player1.elo + player2.elo) / 2);
      const puzzle = await puzzleService.selectPuzzleByElo(avgElo, {
        difficulty: player1.preferences.difficulty || player2.preferences.difficulty,
        timeLimit: player1.preferences.timeLimit || player2.preferences.timeLimit,
      });

      if (!puzzle) {
        console.error('No suitable puzzle found for match');
        return;
      }

      // Create battle room
      const roomId = uuidv4();
      const battleRoom: BattleRoom = {
        id: roomId,
        player1Id: player1.userId,
        player2Id: player2.userId,
        puzzleId: puzzle.id,
        state: 'WAITING',
        timeLimit: player1.preferences.timeLimit || player2.preferences.timeLimit || 600000, // 10 minutes default
        currentRound: 1,
      };

      // Create participants
      const participants: BattleParticipant[] = [
        {
          userId: player1.userId,
          username: player1.username,
          elo: player1.elo,
          hp: 500,
          maxHp: 500,
          mana: 50,
          maxMana: 100,
          submissions: 0,
          lastActivity: new Date(),
          isDisconnected: false,
        },
        {
          userId: player2.userId,
          username: player2.username,
          elo: player2.elo,
          hp: 500,
          maxHp: 500,
          mana: 50,
          maxMana: 100,
          submissions: 0,
          lastActivity: new Date(),
          isDisconnected: false,
        },
      ];

      // Store battle room in Redis
      await redisService.createBattleRoom(battleRoom, participants);

      // Initialize battle room service
      await battleRoomService.initializeBattle(roomId, puzzle);

      // Publish match found event
      await redisService.publish(`match_found:${player1.userId}`, {
        roomId,
        opponent: participants[1],
        puzzle,
      });

      await redisService.publish(`match_found:${player2.userId}`, {
        roomId,
        opponent: participants[0],
        puzzle,
      });

      console.log(`Match created: ${player1.userId} vs ${player2.userId} in room ${roomId}`);
    } catch (error) {
      console.error('Error creating match:', error);
    }
  }

  private calculateEstimatedWaitTime(queueSize: number, userElo: number): number {
    // Base wait time calculation
    const baseWaitTime = Math.max(0, (queueSize - 1) * 2000); // 2 seconds per person ahead
    
    // ELO-based adjustment (higher ELO = longer wait in smaller pool)
    const eloMultiplier = userElo > 1500 ? 1.5 : userElo < 1000 ? 0.7 : 1.0;
    
    return Math.round(baseWaitTime * eloMultiplier);
  }

  // Window Expansion Logic
  private expandEloWindow(): void {
    const now = Date.now();
    const timeSinceLastExpansion = now - this.lastWindowExpansion;

    if (timeSinceLastExpansion >= MATCHMAKING_CONFIG.WINDOW_EXPANSION_INTERVAL) {
      this.eloWindowMultiplier = Math.min(
        this.eloWindowMultiplier + 0.5,
        MATCHMAKING_CONFIG.MAX_ELO_WINDOW / MATCHMAKING_CONFIG.INITIAL_ELO_WINDOW
      );
      this.lastWindowExpansion = now;
      
      console.log(`ELO window expanded to multiplier: ${this.eloWindowMultiplier}`);
    }
  }

  // Matchmaking Scanner Control
  private startMatchmakingScan(): void {
    this.scanInterval = setInterval(() => {
      this.scanForMatches();
      this.expandEloWindow();
    }, MATCHMAKING_CONFIG.SCAN_INTERVAL);
  }

  public stopMatchmakingScan(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  public resetEloWindow(): void {
    this.eloWindowMultiplier = 1;
    this.lastWindowExpansion = Date.now();
  }

  // Cleanup
  async cleanupExpiredQueueEntries(): Promise<void> {
    try {
      const queueEntries = await redisService.getQueueEntries();
      const now = Date.now();
      
      for (const entry of queueEntries) {
        const timeInQueue = now - entry.joinedAt.getTime();
        if (timeInQueue > MATCHMAKING_CONFIG.QUEUE_TIMEOUT) {
          await redisService.removeFromQueue(entry.userId);
          console.log(`Removed expired queue entry: ${entry.userId}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired queue entries:', error);
    }
  }

  // Statistics
  async getMatchmakingStats(): Promise<{
    queueSize: number;
    avgWaitTime: number;
    eloWindowMultiplier: number;
  }> {
    const queueSize = await redisService.getQueueSize();
    const queueEntries = await redisService.getQueueEntries();
    
    let avgWaitTime = 0;
    if (queueEntries.length > 0) {
      const now = Date.now();
      const totalWaitTime = queueEntries.reduce((sum, entry) => {
        return sum + (now - entry.joinedAt.getTime());
      }, 0);
      avgWaitTime = totalWaitTime / queueEntries.length;
    }

    return {
      queueSize,
      avgWaitTime,
      eloWindowMultiplier: this.eloWindowMultiplier,
    };
  }
}

export const matchmakingService = new MatchmakingService();
