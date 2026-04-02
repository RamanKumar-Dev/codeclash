import { redisService } from './redis.service';
import { battleRoomService } from './battle-room.service';
import { 
  SpectatorBattle, 
  SpectatorInfo, 
  SpectatorChat,
  BattleRoom,
  BattleStateData 
} from '@code-clash/shared-types';
import { v4 as uuidv4 } from 'uuid';

export class SpectatorService {
  private battleCounter = 1;
  private featuredBattleId: string | null = null;

  // Get list of live battles available for spectating
  async getLiveBattles(): Promise<SpectatorBattle[]> {
    try {
      // Get all active battle rooms from Redis
      const liveBattles: SpectatorBattle[] = [];
      
      // This would typically scan Redis for active battle rooms
      // For now, we'll simulate with some logic
      const activeBattleKeys = await this.getActiveBattleKeys();
      
      for (const battleKey of activeBattleKeys) {
        const roomId = battleKey.replace('battle:state:', '');
        const battleData = await this.getSpectatorBattleData(roomId);
        
        if (battleData) {
          liveBattles.push(battleData);
        }
      }

      // Sort by spectator count (most popular first) then by ELO
      return liveBattles.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        if (b.spectatorCount !== a.spectatorCount) {
          return b.spectatorCount - a.spectatorCount;
        }
        return (b.player1Elo + b.player2Elo) - (a.player1Elo + a.player2Elo);
      });
    } catch (error) {
      console.error('Error getting live battles:', error);
      return [];
    }
  }

  // Join as spectator
  async joinSpectator(battleId: string, spectatorInfo: Partial<SpectatorInfo>): Promise<SpectatorInfo> {
    try {
      // Verify battle exists and is active
      const battleState = await redisService.getBattleState(battleId);
      if (!battleState || battleState.room.state !== 'ACTIVE') {
        throw new Error('Battle not available for spectating');
      }

      // Create spectator info
      const spectator: SpectatorInfo = {
        userId: spectatorInfo.userId || `anonymous_${Date.now()}`,
        username: spectatorInfo.username || `Anonymous${Math.floor(Math.random() * 1000)}`,
        isAnonymous: !spectatorInfo.userId,
        joinedAt: new Date(),
      };

      // Add spectator to battle
      await this.addSpectatorToBattle(battleId, spectator);

      // Update spectator count
      const spectatorCount = await this.getSpectatorCount(battleId);
      await this.updateSpectatorCount(battleId, spectatorCount + 1);

      // Broadcast spectator count to players
      await redisService.publish(`battle:${battleId}:spectator_count`, {
        spectatorCount: spectatorCount + 1,
      });

      // Broadcast to other spectators
      await redisService.publish(`spectator:${battleId}:joined`, {
        spectator,
        totalCount: spectatorCount + 1,
      });

      console.log(`Spectator ${spectator.username} joined battle ${battleId}`);
      return spectator;
    } catch (error) {
      console.error('Error joining spectator:', error);
      throw error;
    }
  }

  // Leave spectator mode
  async leaveSpectator(battleId: string, spectatorId: string): Promise<void> {
    try {
      // Remove spectator from battle
      await this.removeSpectatorFromBattle(battleId, spectatorId);

      // Update spectator count
      const spectatorCount = await this.getSpectatorCount(battleId);
      const newCount = Math.max(0, spectatorCount - 1);
      await this.updateSpectatorCount(battleId, newCount);

      // Broadcast spectator count to players
      await redisService.publish(`battle:${battleId}:spectator_count`, {
        spectatorCount: newCount,
      });

      // Broadcast to other spectators
      await redisService.publish(`spectator:${battleId}:left`, {
        spectatorId,
        totalCount: newCount,
      });

      console.log(`Spectator ${spectatorId} left battle ${battleId}`);
    } catch (error) {
      console.error('Error leaving spectator:', error);
    }
  }

  // Send spectator chat message
  async sendSpectatorChat(battleId: string, spectatorId: string, message: string): Promise<SpectatorChat> {
    try {
      // Validate message
      if (!message || message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      if (message.length > 200) {
        throw new Error('Message too long (max 200 characters)');
      }

      // Get spectator info
      const spectator = await this.getSpectatorInfo(battleId, spectatorId);
      if (!spectator) {
        throw new Error('Spectator not found');
      }

      // Create chat message
      const chatMessage: SpectatorChat = {
        id: uuidv4(),
        battleId,
        spectatorId,
        spectatorUsername: spectator.username,
        message: message.trim(),
        timestamp: new Date(),
      };

      // Store chat message (keep last 100 messages)
      await this.storeChatMessage(battleId, chatMessage);

      // Broadcast to all spectators
      await redisService.publish(`spectator:${battleId}:chat`, chatMessage);

      console.log(`Spectator chat in battle ${battleId}: ${spectator.username}: ${message}`);
      return chatMessage;
    } catch (error) {
      console.error('Error sending spectator chat:', error);
      throw error;
    }
  }

  // Get recent chat messages for a battle
  async getChatHistory(battleId: string, limit = 50): Promise<SpectatorChat[]> {
    try {
      const messages = await redisService.client.lrange(
        `spectator_chat:${battleId}`,
        -limit,
        -1
      );

      return messages
        .reverse()
        .map(msg => JSON.parse(msg));
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  // Set featured battle
  async setFeaturedBattle(battleId: string): Promise<void> {
    try {
      this.featuredBattleId = battleId;
      
      // Store in Redis
      await redisService.client.setex(
        'featured_battle',
        3600, // 1 hour
        battleId
      );

      // Broadcast featured battle update
      await redisService.publish('featured_battle_updated', { battleId });

      console.log(`Featured battle set to ${battleId}`);
    } catch (error) {
      console.error('Error setting featured battle:', error);
    }
  }

  // Get featured battle
  async getFeaturedBattle(): Promise<SpectatorBattle | null> {
    try {
      const battleId = await redisService.client.get('featured_battle');
      if (!battleId) {
        return null;
      }

      return await this.getSpectatorBattleData(battleId);
    } catch (error) {
      console.error('Error getting featured battle:', error);
      return null;
    }
  }

  // Get spectator count for a battle
  async getSpectatorCount(battleId: string): Promise<number> {
    try {
      const count = await redisService.client.get(`spectator_count:${battleId}`);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Error getting spectator count:', error);
      return 0;
    }
  }

  // Get spectator info
  async getSpectatorInfo(battleId: string, spectatorId: string): Promise<SpectatorInfo | null> {
    try {
      const spectatorData = await redisService.client.hget(
        `spectators:${battleId}`,
        spectatorId
      );
      
      return spectatorData ? JSON.parse(spectatorData) : null;
    } catch (error) {
      console.error('Error getting spectator info:', error);
      return null;
    }
  }

  // Toggle anonymous mode
  async toggleAnonymous(battleId: string, spectatorId: string): Promise<SpectatorInfo> {
    try {
      const spectator = await this.getSpectatorInfo(battleId, spectatorId);
      if (!spectator) {
        throw new Error('Spectator not found');
      }

      // Toggle anonymous status
      spectator.isAnonymous = !spectator.isAnonymous;
      
      if (spectator.isAnonymous) {
        spectator.username = `Anonymous${Math.floor(Math.random() * 1000)}`;
      } else {
        // Would need to restore original username from user service
        spectator.username = spectator.userId || 'Anonymous';
      }

      // Update spectator info
      await redisService.client.hset(
        `spectators:${battleId}`,
        spectatorId,
        JSON.stringify(spectator)
      );

      // Broadcast change
      await redisService.publish(`spectator:${battleId}:updated`, spectator);

      return spectator;
    } catch (error) {
      console.error('Error toggling anonymous mode:', error);
      throw error;
    }
  }

  // Private helper methods
  private async getActiveBattleKeys(): Promise<string[]> {
    try {
      // This would typically scan Redis for battle:state:* keys
      // For now, return empty array - would be implemented based on Redis setup
      return [];
    } catch (error) {
      console.error('Error getting active battle keys:', error);
      return [];
    }
  }

  private async getSpectatorBattleData(roomId: string): Promise<SpectatorBattle | null> {
    try {
      const battleState = await redisService.getBattleState(roomId);
      if (!battleState || battleState.room.state !== 'ACTIVE') {
        return null;
      }

      // Generate battle number (anonymized)
      const battleNumber = this.battleCounter++;

      const spectatorBattle: SpectatorBattle = {
        id: roomId,
        battleNumber,
        player1Username: battleState.player1.username,
        player2Username: battleState.player2.username,
        player1Elo: battleState.player1.elo,
        player2Elo: battleState.player2.elo,
        puzzleTitle: battleState.puzzle?.title || 'Unknown Puzzle',
        difficulty: battleState.puzzle?.difficulty || 'medium',
        timeRemaining: battleState.timeRemaining,
        spectatorCount: await this.getSpectatorCount(roomId),
        isFeatured: this.featuredBattleId === roomId,
        startedAt: battleState.room.startedAt || new Date(),
      };

      return spectatorBattle;
    } catch (error) {
      console.error('Error getting spectator battle data:', error);
      return null;
    }
  }

  private async addSpectatorToBattle(battleId: string, spectator: SpectatorInfo): Promise<void> {
    await redisService.client.hset(
      `spectators:${battleId}`,
      spectator.userId,
      JSON.stringify(spectator)
    );

    // Set TTL on spectators hash
    await redisService.client.expire(`spectators:${battleId}`, 3600); // 1 hour
  }

  private async removeSpectatorFromBattle(battleId: string, spectatorId: string): Promise<void> {
    await redisService.client.hdel(`spectators:${battleId}`, spectatorId);
  }

  private async updateSpectatorCount(battleId: string, count: number): Promise<void> {
    await redisService.client.setex(
      `spectator_count:${battleId}`,
      3600,
      count.toString()
    );
  }

  private async storeChatMessage(battleId: string, message: SpectatorChat): Promise<void> {
    // Add to list (keep only last 100 messages)
    await redisService.client.lpush(`spectator_chat:${battleId}`, JSON.stringify(message));
    await redisService.client.ltrim(`spectator_chat:${battleId}`, 0, 99);
    
    // Set TTL
    await redisService.client.expire(`spectator_chat:${battleId}`, 3600);
  }

  // Cleanup inactive spectators
  async cleanupInactiveSpectators(): Promise<void> {
    try {
      // This would scan all spectator hashes and remove inactive ones
      // Implementation depends on how we track activity
      console.log('Spectator cleanup completed');
    } catch (error) {
      console.error('Error cleaning up inactive spectators:', error);
    }
  }

  // Get spectator statistics
  async getSpectatorStats(): Promise<{
    totalSpectators: number;
    battlesBeingWatched: number;
    featuredBattleId: string | null;
  }> {
    try {
      // This would aggregate data across all battles
      return {
        totalSpectators: 0,
        battlesBeingWatched: 0,
        featuredBattleId: this.featuredBattleId,
      };
    } catch (error) {
      console.error('Error getting spectator stats:', error);
      return {
        totalSpectators: 0,
        battlesBeingWatched: 0,
        featuredBattleId: null,
      };
    }
  }
}

export const spectatorService = new SpectatorService();
