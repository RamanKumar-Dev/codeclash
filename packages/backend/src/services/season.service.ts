import { SeasonModel } from '../models/season.model';
import { RedisService } from './redis.service';
import { LeaderboardService } from './leaderboard.service';
import { UserService } from './user.service';
import { 
  Season, 
  SeasonReward, 
  SeasonTopPlayer,
  LEADERBOARD_KEYS,
  User
} from '@code-clash/shared-types';

export class SeasonService {
  constructor(
    private redisService: RedisService,
    private leaderboardService: LeaderboardService,
    private userService: UserService
  ) {}

  async createSeason(name: string, durationDays: number = 30): Promise<Season> {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    
    // Deactivate any existing active seasons
    await SeasonModel.updateMany({ isActive: true }, { isActive: false });

    const seasonNumber = await this.getNextSeasonNumber();
    const seasonId = `season_${seasonNumber}`;
    
    const defaultRewards: SeasonReward[] = [
      { rank: 1, rewardType: 'badge', value: '🏆 Champion', description: 'Season Champion Badge' },
      { rank: 2, rewardType: 'badge', value: '🥈 Runner-up', description: 'Season Runner-up Badge' },
      { rank: 3, rewardType: 'badge', value: '🥉 Third Place', description: 'Season Third Place Badge' },
      { rank: 4, rewardType: 'badge', value: '⭐ Elite', description: 'Elite Player Badge' },
      { rank: 10, rewardType: 'badge', value: '💎 Diamond', description: 'Diamond Player Badge' },
      { rank: 25, rewardType: 'tokens', value: 500, description: '500 Tokens' },
      { rank: 50, rewardType: 'tokens', value: 250, description: '250 Tokens' },
      { rank: 100, rewardType: 'tokens', value: 100, description: '100 Tokens' }
    ];

    const season = await SeasonModel.create({
      seasonId,
      name: name || `Season ${seasonNumber}`,
      startDate,
      endDate,
      isActive: true,
      rewards: defaultRewards,
      topPlayers: []
    });

    // Store current season info in Redis
    await this.redisService.set(LEADERBOARD_KEYS.SEASON_INFO, JSON.stringify(season.toJSON()), 'EX', 30 * 24 * 60 * 60);

    return {
      id: season._id.toString(),
      seasonId: season.seasonId,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
      isActive: season.isActive,
      rewards: season.rewards,
      topPlayers: season.topPlayers,
      createdAt: season.createdAt,
      updatedAt: season.updatedAt
    };
  }

  async getCurrentSeason(): Promise<Season | null> {
    try {
      // Try Redis cache first
      const cached = await this.redisService.get(LEADERBOARD_KEYS.SEASON_INFO);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to database
      const season = await SeasonModel.findOne({ isActive: true }).lean();
      if (!season) return null;

      const seasonData: Season = {
        id: season._id.toString(),
        seasonId: season.seasonId,
        name: season.name,
        startDate: season.startDate,
        endDate: season.endDate,
        isActive: season.isActive,
        rewards: season.rewards,
        topPlayers: season.topPlayers,
        createdAt: season.createdAt,
        updatedAt: season.updatedAt
      };

      // Cache in Redis
      await this.redisService.set(LEADERBOARD_KEYS.SEASON_INFO, JSON.stringify(seasonData), 'EX', 30 * 24 * 60 * 60);

      return seasonData;
    } catch (error) {
      console.error('Error getting current season:', error);
      return null;
    }
  }

  async endSeason(seasonId: string): Promise<void> {
    try {
      const season = await SeasonModel.findOne({ seasonId, isActive: true });
      if (!season) {
        throw new Error('Active season not found');
      }

      // Get top 100 players from seasonal leaderboard
      const topEntries = await this.leaderboardService.getTopPlayers(seasonId, 100);
      
      // Create top players data
      const topPlayers: SeasonTopPlayer[] = [];
      for (const entry of topEntries) {
        const rewards = this.calculateRewards(entry.rank, season.rewards);
        topPlayers.push({
          userId: entry.userId,
          username: entry.username,
          rank: entry.rank,
          elo: entry.elo,
          battlesWon: entry.battlesWon,
          rewards
        });

        // Award rewards to users
        await this.awardRewards(entry.userId, rewards);
      }

      // Update season with top players
      await SeasonModel.updateOne(
        { seasonId },
        { 
          isActive: false, 
          topPlayers,
          endDate: new Date()
        }
      );

      // Reset seasonal ELO for all users
      await this.resetSeasonalELO();

      // Clear season cache
      await this.redisService.del(LEADERBOARD_KEYS.SEASON_INFO);

      // Create new season
      await this.createSeason();

      console.log(`Season ${seasonId} ended successfully`);
    } catch (error) {
      console.error('Error ending season:', error);
      throw error;
    }
  }

  private async getNextSeasonNumber(): Promise<number> {
    const lastSeason = await SeasonModel.findOne().sort({ createdAt: -1 });
    if (!lastSeason) return 1;
    
    const match = lastSeason.seasonId.match(/season_(\d+)/);
    return match ? parseInt(match[1]) + 1 : 1;
  }

  private calculateRewards(rank: number, seasonRewards: SeasonReward[]): SeasonReward[] {
    const rewards: SeasonReward[] = [];
    
    for (const reward of seasonRewards) {
      if (rank <= reward.rank) {
        rewards.push(reward);
      }
    }
    
    return rewards;
  }

  private async awardRewards(userId: string, rewards: SeasonReward[]): Promise<void> {
    const user = await this.userService.getUserById(userId);
    if (!user) return;

    const updates: Partial<User> = {
      seasonBadges: [...user.seasonBadges]
    };

    for (const reward of rewards) {
      switch (reward.rewardType) {
        case 'badge':
          if (typeof reward.value === 'string' && !updates.seasonBadges!.includes(reward.value)) {
            updates.seasonBadges!.push(reward.value);
          }
          break;
        case 'tokens':
          if (typeof reward.value === 'number') {
            updates.tokens = (user.tokens || 0) + reward.value;
          }
          break;
        case 'xp':
          if (typeof reward.value === 'number') {
            updates.xp = user.xp + reward.value;
          }
          break;
        case 'title':
          // Handle title rewards (could be added to user profile)
          break;
      }
    }

    await this.userService.updateUser(userId, updates);
  }

  private async resetSeasonalELO(): Promise<void> {
    // Reset seasonal ELO for all users to their base ELO
    // This would typically be done in a background job
    console.log('Resetting seasonal ELO for all users');
  }

  async getSeasonHistory(limit: number = 10): Promise<Season[]> {
    const seasons = await SeasonModel
      .find()
      .sort({ endDate: -1 })
      .limit(limit)
      .lean();

    return seasons.map(season => ({
      id: season._id.toString(),
      seasonId: season.seasonId,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
      isActive: season.isActive,
      rewards: season.rewards,
      topPlayers: season.topPlayers,
      createdAt: season.createdAt,
      updatedAt: season.updatedAt
    }));
  }

  async getSeasonSummary(userId: string, seasonId: string): Promise<any> {
    const season = await SeasonModel.findOne({ seasonId }).lean();
    if (!season) {
      throw new Error('Season not found');
    }

    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userRank = await this.leaderboardService.getUserRank(userId, 'season', seasonId);
    const eloJourney = await this.getEloJourney(userId, seasonId);
    
    const userRewards = season.topPlayers
      .find(player => player.userId === userId)
      ?.rewards || [];

    const nextSeasonStart = new Date(season.endDate.getTime() + 24 * 60 * 60 * 1000);

    return {
      season: {
        id: season._id.toString(),
        seasonId: season.seasonId,
        name: season.name,
        startDate: season.startDate,
        endDate: season.endDate,
        isActive: season.isActive,
        rewards: season.rewards,
        topPlayers: season.topPlayers,
        createdAt: season.createdAt,
        updatedAt: season.updatedAt
      },
      userRank: userRank?.rank,
      userElo: user.seasonalElo,
      userRewards,
      eloJourney,
      nextSeasonStart
    };
  }

  private async getEloJourney(userId: string, seasonId: string): Promise<{ date: Date; elo: number }[]> {
    try {
      const journeyKey = LEADERBOARD_KEYS.ELO_JOURNEY(userId, seasonId);
      const journeyData = await this.redisService.lrange(journeyKey, 0, -1);
      
      return journeyData.map(entry => JSON.parse(entry));
    } catch (error) {
      console.error('Error getting ELO journey:', error);
      return [];
    }
  }

  async trackEloProgress(userId: string, seasonId: string, elo: number): Promise<void> {
    const journeyKey = LEADERBOARD_KEYS.ELO_JOURNEY(userId, seasonId);
    const entry = { date: new Date(), elo };
    
    await this.redisService.lpush(journeyKey, JSON.stringify(entry));
    await this.redisService.expire(journeyKey, 90 * 24 * 60 * 60); // Keep for 90 days
  }

  async getTimeUntilSeasonEnd(): Promise<{ days: number; hours: number; minutes: number; seconds: number } | null> {
    const currentSeason = await this.getCurrentSeason();
    if (!currentSeason) return null;

    const now = new Date();
    const timeLeft = currentSeason.endDate.getTime() - now.getTime();
    
    if (timeLeft <= 0) return null;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }
}
