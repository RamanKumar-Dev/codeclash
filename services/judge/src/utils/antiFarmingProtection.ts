import { PrismaClient } from '@prisma/client';
import { RankSystem } from './rankSystem';

export interface AntiFarmingConfig {
  minWaitBetweenBattles: number; // 5 minutes in milliseconds
  maxDailyBattles: number;
  inactivityDecayDays: number;
  weeklyDecayAmount: number;
  maxDecayPerSeason: number;
  newPlayerBattleLimit: number;
  newPlayerMaxEloDiff: number;
}

export const DEFAULT_ANTI_FARMING_CONFIG: AntiFarmingConfig = {
  minWaitBetweenBattles: 5 * 60 * 1000, // 5 minutes
  maxDailyBattles: 20,
  inactivityDecayDays: 7,
  weeklyDecayAmount: 25,
  maxDecayPerSeason: 200,
  newPlayerBattleLimit: 10,
  newPlayerMaxEloDiff: 200
};

export class AntiFarmingProtection {
  private prisma: PrismaClient;
  private config: AntiFarmingConfig;

  constructor(prisma: PrismaClient, config: AntiFarmingConfig = DEFAULT_ANTI_FARMING_CONFIG) {
    this.prisma = prisma;
    this.config = config;
  }

  /**
   * Check if player can battle based on rate limiting
   */
  async canBattle(playerId: string, opponentId: string): Promise<{
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  }> {
    const player = await this.prisma.user.findUnique({
      where: { id: playerId },
      select: { 
        lastBattleAt: true, 
        battlesToday: true, 
        dailyBattleReset: true,
        createdAt: true,
        elo: true
      }
    });

    if (!player) {
      return { allowed: false, reason: 'Player not found' };
    }

    // Check daily battle limit
    const now = new Date();
    const isDailyResetNeeded = now > player.dailyBattleReset;
    
    if (isDailyResetNeeded) {
      // Reset daily battle count
      await this.prisma.user.update({
        where: { id: playerId },
        data: {
          battlesToday: 0,
          dailyBattleReset: new Date(now.getTime() + 24 * 60 * 60 * 1000) // Next day
        }
      });
    } else if (player.battlesToday >= this.config.maxDailyBattles) {
      return { allowed: false, reason: 'Daily battle limit reached' };
    }

    // Check minimum wait time between battles against same opponent
    const recentBattle = await this.getRecentBattleAgainstOpponent(playerId, opponentId);
    if (recentBattle) {
      const timeSinceLastBattle = now.getTime() - recentBattle.getTime();
      if (timeSinceLastBattle < this.config.minWaitBetweenBattles) {
        const waitTime = this.config.minWaitBetweenBattles - timeSinceLastBattle;
        return { 
          allowed: false, 
          reason: 'Must wait before battling same opponent again',
          waitTime: Math.ceil(waitTime / 1000 / 60) // minutes
        };
      }
    }

    // Check new player restrictions
    const isNewPlayer = await this.isNewPlayer(playerId);
    if (isNewPlayer) {
      const opponent = await this.prisma.user.findUnique({
        where: { id: opponentId },
        select: { elo: true }
      });

      if (opponent && Math.abs(player.elo - opponent.elo) > this.config.newPlayerMaxEloDiff) {
        return { allowed: false, reason: 'New player ELO difference too large' };
      }
    }

    return { allowed: true };
  }

  /**
   * Get recent battle against specific opponent
   */
  private async getRecentBattleAgainstOpponent(playerId: string, opponentId: string): Promise<Date | null> {
    const recentMatch = await this.prisma.match.findFirst({
      where: {
        OR: [
          { player1Id: playerId, player2Id: opponentId },
          { player1Id: opponentId, player2Id: playerId }
        ],
        status: 'COMPLETED',
        endedAt: { not: null }
      },
      orderBy: { endedAt: 'desc' }
    });

    return recentMatch?.endedAt || null;
  }

  /**
   * Check if player is considered new (first 10 battles)
   */
  private async isNewPlayer(playerId: string): Promise<boolean> {
    const totalBattles = await this.prisma.match.count({
      where: {
        OR: [
          { player1Id: playerId },
          { player2Id: playerId }
        ],
        status: 'COMPLETED'
      }
    });

    return totalBattles < this.config.newPlayerBattleLimit;
  }

  /**
   * Apply ELO decay for inactive players
   */
  async applyEloDecay(): Promise<number> {
    const inactiveDate = new Date(Date.now() - this.config.inactivityDecayDays * 24 * 60 * 60 * 1000);
    
    const inactiveUsers = await this.prisma.user.findMany({
      where: {
        lastActiveAt: { lt: inactiveDate },
        elo: { gt: RankSystem.getMinimumElo() } // Only decay if above minimum
      },
      select: { 
        id: true, 
        elo: true, 
        username: true,
        seasonalElo: true
      }
    });

    let decayedCount = 0;

    for (const user of inactiveUsers) {
      // Apply decay to both global and seasonal ELO
      const newGlobalElo = Math.max(
        RankSystem.getMinimumElo(),
        user.elo - this.config.weeklyDecayAmount
      );
      
      const newSeasonalElo = Math.max(
        RankSystem.getMinimumElo(),
        user.seasonalElo - this.config.weeklyDecayAmount
      );

      // Check if we would exceed maximum decay per season
      const seasonDecayAmount = user.elo - newGlobalElo;
      if (seasonDecayAmount > this.config.maxDecayPerSeason) {
        continue; // Skip this user to prevent excessive decay
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          elo: newGlobalElo,
          seasonalElo: newSeasonalElo,
          rankTier: RankSystem.getRankByElo(newGlobalElo).tier
        }
      });

      console.log(`ELO decay applied to ${user.username}: ${user.elo} → ${newGlobalElo} (-${seasonDecayAmount})`);
      decayedCount++;
    }

    return decayedCount;
  }

  /**
   * Update player activity and battle statistics
   */
  async updatePlayerActivity(playerId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: playerId },
      data: {
        lastActiveAt: new Date(),
        battlesToday: { increment: 1 }
      }
    });
  }

  /**
   * Record battle completion for anti-farming tracking
   */
  async recordBattleCompletion(playerId: string, opponentId: string): Promise<void> {
    await this.updatePlayerActivity(playerId);
    
    // Update last battle time
    await this.prisma.user.update({
      where: { id: playerId },
      data: { lastBattleAt: new Date() }
    });
  }

  /**
   * Detect suspicious battle patterns
   */
  async detectSuspiciousPatterns(playerId: string): Promise<{
    suspicious: boolean;
    reasons: string[];
    confidence: number;
  }> {
    const reasons: string[] = [];
    let confidence = 0;

    // Check for frequent battles against same opponent
    const recentBattles = await this.prisma.match.findMany({
      where: {
        OR: [
          { player1Id: playerId },
          { player2Id: playerId }
        ],
        status: 'COMPLETED',
        endedAt: { 
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        player1: { select: { username: true } },
        player2: { select: { username: true } }
      }
    });

    // Count battles per opponent
    const opponentCounts: Record<string, number> = {};
    recentBattles.forEach(battle => {
      const opponentId = battle.player1Id === playerId ? battle.player2Id : battle.player1Id;
      opponentCounts[opponentId] = (opponentCounts[opponentId] || 0) + 1;
    });

    // Check if battling same opponent too frequently
    const maxBattlesVsOpponent = Math.max(...Object.values(opponentCounts));
    if (maxBattlesVsOpponent > 5) {
      reasons.push('Excessive battles against same opponent');
      confidence += 0.3;
    }

    // Check for unusual win/loss patterns
    const wins = recentBattles.filter(b => b.winnerId === playerId).length;
    const totalBattles = recentBattles.length;
    
    if (totalBattles > 0) {
      const winRate = wins / totalBattles;
      
      // Very high win rate with low ELO could indicate farming
      const player = await this.prisma.user.findUnique({
        where: { id: playerId },
        select: { elo: true }
      });

      if (player && player.elo < 1200 && winRate > 0.9 && totalBattles > 10) {
        reasons.push('Suspicious high win rate at low ELO');
        confidence += 0.4;
      }

      // Very low win rate with high ELO could indicate tanking
      if (player && player.elo > 1800 && winRate < 0.1 && totalBattles > 10) {
        reasons.push('Suspicious low win rate at high ELO');
        confidence += 0.4;
      }
    }

    // Check for rapid ELO changes
    const eloHistory = await this.prisma.eloHistory.findMany({
      where: { 
        userId: playerId,
        timestamp: { 
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    if (eloHistory.length > 1) {
      const eloChange = Math.abs(eloHistory[eloHistory.length - 1].elo - eloHistory[0].elo);
      if (eloChange > 200) {
        reasons.push('Rapid ELO change detected');
        confidence += 0.3;
      }
    }

    return {
      suspicious: confidence > 0.5,
      reasons,
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Get anti-farming statistics for monitoring
   */
  async getAntiFarmingStats(): Promise<{
    totalPlayers: number;
    inactivePlayers: number;
    playersAtDailyLimit: number;
    suspiciousPlayers: number;
  }> {
    const now = new Date();
    const inactiveDate = new Date(now.getTime() - this.config.inactivityDecayDays * 24 * 60 * 60 * 1000);

    const [totalPlayers, inactivePlayers, playersAtDailyLimit] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { lastActiveAt: { lt: inactiveDate } }
      }),
      this.prisma.user.count({
        where: { 
          battlesToday: { gte: this.config.maxDailyBattles },
          dailyBattleReset: { gt: now }
        }
      })
    ]);

    // Count suspicious players (simplified - in production would use more sophisticated detection)
    const suspiciousPlayers = 0; // Placeholder for actual detection logic

    return {
      totalPlayers,
      inactivePlayers,
      playersAtDailyLimit,
      suspiciousPlayers
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): AntiFarmingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AntiFarmingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
