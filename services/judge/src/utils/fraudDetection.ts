import { PrismaClient } from '@prisma/client';

export interface FraudDetectionConfig {
  maxBattlesVsSameOpponentPerDay: number;
  maxWinRateForLowElo: number;
  lowEloThreshold: number;
  minBattlesForAnalysis: number;
  maxEloChangePerDay: number;
  suspiciousPatternThreshold: number;
}

export const DEFAULT_FRAUD_CONFIG: FraudDetectionConfig = {
  maxBattlesVsSameOpponentPerDay: 5,
  maxWinRateForLowElo: 0.9,
  lowEloThreshold: 1200,
  minBattlesForAnalysis: 10,
  maxEloChangePerDay: 200,
  suspiciousPatternThreshold: 0.7
};

export interface FraudAlert {
  userId: string;
  username: string;
  alertType: 'excessive_same_opponent' | 'suspicious_win_rate' | 'rapid_elo_change' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  evidence: any;
  timestamp: Date;
}

export class FraudDetectionService {
  private prisma: PrismaClient;
  private config: FraudDetectionConfig;

  constructor(prisma: PrismaClient, config: FraudDetectionConfig = DEFAULT_FRAUD_CONFIG) {
    this.prisma = prisma;
    this.config = config;
  }

  /**
   * Comprehensive fraud detection analysis for a user
   */
  async analyzeUser(userId: string): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];
    
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, elo: true, seasonalElo: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check for excessive battles against same opponent
      const sameOpponentAlert = await this.checkExcessiveSameOpponentBattles(user);
      if (sameOpponentAlert) alerts.push(sameOpponentAlert);

      // Check for suspicious win rate at low ELO
      const winRateAlert = await this.checkSuspiciousWinRate(user);
      if (winRateAlert) alerts.push(winRateAlert);

      // Check for rapid ELO changes
      const eloChangeAlert = await this.checkRapidEloChange(user);
      if (eloChangeAlert) alerts.push(eloChangeAlert);

      // Check for unusual patterns
      const patternAlert = await this.checkUnusualPatterns(user);
      if (patternAlert) alerts.push(patternAlert);

      return alerts;

    } catch (error) {
      console.error('Error in fraud detection analysis:', error);
      return [];
    }
  }

  /**
   * Check for excessive battles against the same opponent
   */
  private async checkExcessiveSameOpponentBattles(user: any): Promise<FraudAlert | null> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentBattles = await this.prisma.match.findMany({
      where: {
        OR: [
          { player1Id: user.id },
          { player2Id: user.id }
        ],
        status: 'COMPLETED',
        endedAt: { gte: oneDayAgo }
      }
    });

    // Count battles per opponent
    const opponentCounts: Record<string, number> = {};
    recentBattles.forEach(battle => {
      const opponentId = battle.player1Id === user.id ? battle.player2Id : battle.player1Id;
      opponentCounts[opponentId] = (opponentCounts[opponentId] || 0) + 1;
    });

    // Find the opponent with most battles
    const maxBattlesVsOpponent = Math.max(...Object.values(opponentCounts));
    
    if (maxBattlesVsOpponent > this.config.maxBattlesVsSameOpponentPerDay) {
      return {
        userId: user.id,
        username: user.username,
        alertType: 'excessive_same_opponent',
        severity: maxBattlesVsOpponent > 10 ? 'high' : 'medium',
        confidence: Math.min(maxBattlesVsOpponent / this.config.maxBattlesVsSameOpponentPerDay, 1.0),
        description: `Excessive battles against same opponent: ${maxBattlesVsOpponent} in 24 hours`,
        evidence: { opponentCounts, maxBattlesVsOpponent },
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Check for suspiciously high win rate at low ELO
   */
  private async checkSuspiciousWinRate(user: any): Promise<FraudAlert | null> {
    const recentBattles = await this.prisma.match.findMany({
      where: {
        OR: [
          { player1Id: user.id },
          { player2Id: user.id }
        ],
        status: 'COMPLETED',
        endedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      },
      take: 50
    });

    if (recentBattles.length < this.config.minBattlesForAnalysis) {
      return null;
    }

    const wins = recentBattles.filter(battle => battle.winnerId === user.id).length;
    const winRate = wins / recentBattles.length;

    // Check if user has suspiciously high win rate at low ELO
    if (user.elo < this.config.lowEloThreshold && winRate > this.config.maxWinRateForLowElo) {
      return {
        userId: user.id,
        username: user.username,
        alertType: 'suspicious_win_rate',
        severity: winRate > 0.95 ? 'critical' : 'high',
        confidence: (winRate - this.config.maxWinRateForLowElo) / (1 - this.config.maxWinRateForLowElo),
        description: `Suspicious high win rate (${(winRate * 100).toFixed(1)}%) at low ELO (${user.elo})`,
        evidence: { winRate, totalBattles: recentBattles.length, wins, elo: user.elo },
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Check for rapid ELO changes
   */
  private async checkRapidEloChange(user: any): Promise<FraudAlert | null> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentBattles = await this.prisma.match.findMany({
      where: {
        OR: [
          { player1Id: user.id },
          { player2Id: user.id }
        ],
        status: 'COMPLETED',
        endedAt: { gte: oneDayAgo }
      },
      orderBy: { endedAt: 'asc' }
    });

    if (recentBattles.length < 5) {
      return null;
    }

    // Simulate ELO progression to find the net change
    let eloChange = 0;
    for (const battle of recentBattles) {
      const won = battle.winnerId === user.id;
      const opponentId = battle.player1Id === user.id ? battle.player2Id : battle.player1Id;
      
      // Get opponent ELO at time of battle (simplified - using current ELO)
      const opponent = await this.prisma.user.findUnique({
        where: { id: opponentId },
        select: { elo: true }
      });

      if (opponent) {
        const expectedScore = 1 / (1 + Math.pow(10, (opponent.elo - user.elo) / 400));
        const actualScore = won ? 1 : 0;
        eloChange += Math.round(32 * (actualScore - expectedScore));
      }
    }

    if (Math.abs(eloChange) > this.config.maxEloChangePerDay) {
      return {
        userId: user.id,
        username: user.username,
        alertType: 'rapid_elo_change',
        severity: Math.abs(eloChange) > 300 ? 'critical' : 'high',
        confidence: Math.min(Math.abs(eloChange) / this.config.maxEloChangePerDay, 1.0),
        description: `Rapid ELO change detected: ${eloChange > 0 ? '+' : ''}${eloChange} in 24 hours`,
        evidence: { eloChange, battlesAnalyzed: recentBattles.length },
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Check for unusual patterns using multiple indicators
   */
  private async checkUnusualPatterns(user: any): Promise<FraudAlert | null> {
    const patterns = {
      quickBattles: 0,
      sameTimeBattles: 0,
      alternatingWins: 0
    };

    const recentBattles = await this.prisma.match.findMany({
      where: {
        OR: [
          { player1Id: user.id },
          { player2Id: user.id }
        ],
        status: 'COMPLETED',
        endedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      orderBy: { endedAt: 'asc' }
    });

    if (recentBattles.length < 10) {
      return null;
    }

    // Analyze battle patterns
    for (let i = 1; i < recentBattles.length; i++) {
      const current = recentBattles[i];
      const previous = recentBattles[i - 1];
      
      // Check for very quick battles (potential intentional losses)
      if (current.endedAt && previous.endedAt) {
        const timeDiff = current.endedAt.getTime() - previous.endedAt.getTime();
        if (timeDiff < 2 * 60 * 1000) { // Less than 2 minutes
          patterns.quickBattles++;
        }
      }

      // Check for battles at same time (potential coordination)
      if (current.endedAt && previous.endedAt) {
        const currentHour = current.endedAt.getHours();
        const previousHour = previous.endedAt.getHours();
        if (currentHour === previousHour) {
          patterns.sameTimeBattles++;
        }
      }

      // Check for alternating wins/losses (potential trading wins)
      const currentWon = current.winnerId === user.id;
      const previousWon = previous.winnerId === user.id;
      if (i > 1 && currentWon !== previousWon) {
        const prevPrev = recentBattles[i - 2];
        const prevPrevWon = prevPrev.winnerId === user.id;
        if (currentWon === prevPrevWon) {
          patterns.alternatingWins++;
        }
      }
    }

    // Calculate pattern score
    const patternScore = (
      (patterns.quickBattles / recentBattles.length) * 0.3 +
      (patterns.sameTimeBattles / recentBattles.length) * 0.3 +
      (patterns.alternatingWins / recentBattles.length) * 0.4
    );

    if (patternScore > this.config.suspiciousPatternThreshold) {
      return {
        userId: user.id,
        username: user.username,
        alertType: 'unusual_pattern',
        severity: patternScore > 0.9 ? 'critical' : 'high',
        confidence: patternScore,
        description: `Unusual battle patterns detected (score: ${(patternScore * 100).toFixed(1)}%)`,
        evidence: patterns,
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Get all fraud alerts for monitoring
   */
  async getAllFraudAlerts(limit: number = 100): Promise<FraudAlert[]> {
    // This would typically store alerts in a database
    // For now, we'll analyze all active users
    const users = await this.prisma.user.findMany({
      select: { id: true, username: true, elo: true },
      take: 50 // Limit to recent active users
    });

    const allAlerts: FraudAlert[] = [];
    
    for (const user of users) {
      const alerts = await this.analyzeUser(user.id);
      allAlerts.push(...alerts);
    }

    // Sort by severity and confidence
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    allAlerts.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    return allAlerts.slice(0, limit);
  }

  /**
   * Get fraud detection statistics
   */
  async getFraudStats(): Promise<any> {
    const alerts = await this.getAllFraudAlerts(1000);
    
    const stats = {
      totalAlerts: alerts.length,
      byType: {
        excessive_same_opponent: alerts.filter(a => a.alertType === 'excessive_same_opponent').length,
        suspicious_win_rate: alerts.filter(a => a.alertType === 'suspicious_win_rate').length,
        rapid_elo_change: alerts.filter(a => a.alertType === 'rapid_elo_change').length,
        unusual_pattern: alerts.filter(a => a.alertType === 'unusual_pattern').length
      },
      bySeverity: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      },
      averageConfidence: alerts.length > 0 ? alerts.reduce((sum, a) => sum + a.confidence, 0) / alerts.length : 0,
      recentHighRisk: alerts.filter(a => 
        a.severity === 'critical' || 
        (a.severity === 'high' && a.confidence > 0.8)
      ).length
    };

    return stats;
  }

  /**
   * Update fraud detection configuration
   */
  updateConfig(newConfig: Partial<FraudDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): FraudDetectionConfig {
    return { ...this.config };
  }
}
