import { RedisService } from './redis.service';
import { UserService } from './user.service';
import { 
  LeaderboardEntry, 
  LeaderboardQuery, 
  LeaderboardResponse,
  RankTier,
  RANK_TIERS,
  LEADERBOARD_KEYS,
  User
} from '@code-clash/shared-types';

export class LeaderboardService {
  constructor(
    private redisService: RedisService,
    private userService: UserService
  ) {}

  async updateLeaderboard(userId: string, elo: number, battlesWon: number, battlesLost: number): Promise<void> {
    const currentSeason = await this.getCurrentSeasonId();
    
    // Update seasonal leaderboard
    const seasonKey = LEADERBOARD_KEYS.SEASON(currentSeason);
    await this.redisService.zadd(seasonKey, elo, userId);
    
    // Update all-time leaderboard
    await this.redisService.zadd(LEADERBOARD_KEYS.ALLTIME, elo, userId);
    
    // Update weekly leaderboard (based on wins)
    const weeklyKey = LEADERBOARD_KEYS.WEEKLY;
    await this.redisService.zadd(weeklyKey, battlesWon, userId);
    
    // Set weekly leaderboard to expire on Monday 00:00 UTC
    await this.setWeeklyExpiration();
  }

  async getLeaderboard(query: LeaderboardQuery, currentUserId?: string): Promise<LeaderboardResponse> {
    const { type = 'season', page = 1, limit = 50, search } = query;
    const offset = (page - 1) * limit;
    
    let key: string;
    let season;
    
    switch (type) {
      case 'season':
        const currentSeason = await this.getCurrentSeasonId();
        key = LEADERBOARD_KEYS.SEASON(currentSeason);
        break;
      case 'alltime':
        key = LEADERBOARD_KEYS.ALLTIME;
        break;
      case 'weekly':
        key = LEADERBOARD_KEYS.WEEKLY;
        break;
      default:
        key = LEADERBOARD_KEYS.ALLTIME;
    }

    // Get total count
    const totalPlayers = await this.redisService.zcard(key);
    const totalPages = Math.ceil(totalPlayers / limit);

    // Get leaderboard entries
    const entries = await this.redisService.zrevrange(key, offset, offset + limit - 1, 'WITHSCORES');
    
    let leaderboardEntries: LeaderboardEntry[] = [];
    
    for (let i = 0; i < entries.length; i += 2) {
      const userId = entries[i];
      const elo = parseInt(entries[i + 1]);
      const rank = offset + Math.floor(i / 2) + 1;
      
      const user = await this.userService.getUserById(userId);
      if (!user) continue;

      const winRate = user.battlesWon + user.battlesLost > 0 
        ? (user.battlesWon / (user.battlesWon + user.battlesLost)) * 100 
        : 0;

      const rankTier = this.getRankTier(elo);
      
      const entry: LeaderboardEntry = {
        userId,
        username: user.username,
        rank,
        elo,
        battlesWon: user.battlesWon,
        battlesLost: user.battlesLost,
        winRate: Math.round(winRate * 100) / 100,
        rankTier,
        isCurrentUser: userId === currentUserId
      };

      // Apply search filter if provided
      if (search && !user.username.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }

      leaderboardEntries.push(entry);
    }

    // Get current user's rank if not in the current page
    let userRank: LeaderboardEntry | undefined;
    if (currentUserId) {
      userRank = await this.getUserRank(currentUserId, type);
    }

    return {
      entries: leaderboardEntries,
      userRank,
      currentSeason: season,
      totalPages,
      currentPage: page,
      totalPlayers
    };
  }

  async getUserRank(userId: string, type: string, seasonId?: string): Promise<LeaderboardEntry | undefined> {
    let key: string;
    
    switch (type) {
      case 'season':
        const currentSeason = seasonId || await this.getCurrentSeasonId();
        key = LEADERBOARD_KEYS.SEASON(currentSeason);
        break;
      case 'alltime':
        key = LEADERBOARD_KEYS.ALLTIME;
        break;
      case 'weekly':
        key = LEADERBOARD_KEYS.WEEKLY;
        break;
      default:
        key = LEADERBOARD_KEYS.ALLTIME;
    }

    try {
      const rank = await this.redisService.zrevrank(key, userId);
      if (rank === null) return undefined;

      const elo = await this.redisService.zscore(key, userId);
      if (elo === null) return undefined;

      const user = await this.userService.getUserById(userId);
      if (!user) return undefined;

      const winRate = user.battlesWon + user.battlesLost > 0 
        ? (user.battlesWon / (user.battlesWon + user.battlesLost)) * 100 
        : 0;

      const rankTier = this.getRankTier(elo);

      return {
        userId,
        username: user.username,
        rank: rank + 1,
        elo: elo,
        battlesWon: user.battlesWon,
        battlesLost: user.battlesLost,
        winRate: Math.round(winRate * 100) / 100,
        rankTier,
        isCurrentUser: true
      };
    } catch (error) {
      console.error('Error getting user rank:', error);
      return undefined;
    }
  }

  async getTopPlayers(seasonId: string, limit: number = 100): Promise<LeaderboardEntry[]> {
    const key = LEADERBOARD_KEYS.SEASON(seasonId);
    const entries = await this.redisService.zrevrange(key, 0, limit - 1, 'WITHSCORES');
    
    const topPlayers: LeaderboardEntry[] = [];
    
    for (let i = 0; i < entries.length; i += 2) {
      const userId = entries[i];
      const elo = parseInt(entries[i + 1]);
      const rank = Math.floor(i / 2) + 1;
      
      const user = await this.userService.getUserById(userId);
      if (!user) continue;

      const winRate = user.battlesWon + user.battlesLost > 0 
        ? (user.battlesWon / (user.battlesWon + user.battlesLost)) * 100 
        : 0;

      const rankTier = this.getRankTier(elo);
      
      topPlayers.push({
        userId,
        username: user.username,
        rank,
        elo,
        battlesWon: user.battlesWon,
        battlesLost: user.battlesLost,
        winRate: Math.round(winRate * 100) / 100,
        rankTier,
        isCurrentUser: false
      });
    }

    return topPlayers;
  }

  getRankTier(elo: number): RankTier {
    for (const tier of Object.values(RANK_TIERS)) {
      if (elo >= tier.minElo && elo <= tier.maxElo) {
        return tier;
      }
    }
    return RANK_TIERS.STONE;
  }

  private async getCurrentSeasonId(): Promise<string> {
    try {
      const seasonData = await this.redisService.get(LEADERBOARD_KEYS.SEASON_INFO);
      if (seasonData) {
        const season = JSON.parse(seasonData);
        return season.seasonId;
      }
      
      // Fallback to default season
      return 'season_1';
    } catch (error) {
      console.error('Error getting current season ID:', error);
      return 'season_1';
    }
  }

  private async setWeeklyExpiration(): Promise<void> {
    // Calculate time until next Monday 00:00 UTC
    const now = new Date();
    const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7; // Next Monday
    const nextMonday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilMonday
    ));
    
    const timeUntilMonday = nextMonday.getTime() - now.getTime();
    const secondsUntilMonday = Math.floor(timeUntilMonday / 1000);
    
    await this.redisService.expire(LEADERBOARD_KEYS.WEEKLY, secondsUntilMonday);
  }

  async getRankDistribution(): Promise<{ [tier: string]: number }> {
    const key = LEADERBOARD_KEYS.ALLTIME;
    const entries = await this.redisService.zrange(key, 0, -1, 'WITHSCORES');
    
    const distribution: { [tier: string]: number } = {};
    
    // Initialize all tiers to 0
    Object.entries(RANK_TIERS).forEach(([key, tier]) => {
      distribution[tier.name] = 0;
    });

    for (let i = 1; i < entries.length; i += 2) {
      const elo = parseInt(entries[i]);
      const tier = this.getRankTier(elo);
      distribution[tier.name]++;
    }

    return distribution;
  }

  async searchUsers(query: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    // This would typically use a more sophisticated search
    // For now, we'll search through recent leaderboard entries
    const key = LEADERBOARD_KEYS.ALLTIME;
    const entries = await this.redisService.zrevrange(key, 0, 999, 'WITHSCORES');
    
    const results: LeaderboardEntry[] = [];
    
    for (let i = 0; i < entries.length && results.length < limit; i += 2) {
      const userId = entries[i];
      const elo = parseInt(entries[i + 1]);
      
      if (!userId) continue;
      
      const user = await this.userService.getUserById(userId);
      if (!user) continue;

      if (user.username.toLowerCase().includes(query.toLowerCase())) {
        const rank = await this.redisService.zrevrank(key, userId);
        const winRate = user.battlesWon + user.battlesLost > 0 
          ? (user.battlesWon / (user.battlesWon + user.battlesLost)) * 100 
          : 0;
        const rankTier = this.getRankTier(elo);

        results.push({
          userId,
          username: user.username,
          rank: rank !== null ? rank + 1 : -1,
          elo,
          battlesWon: user.battlesWon,
          battlesLost: user.battlesLost,
          winRate: Math.round(winRate * 100) / 100,
          rankTier,
          isCurrentUser: false
        });
      }
    }

    return results.sort((a, b) => a.rank - b.rank);
  }
}
