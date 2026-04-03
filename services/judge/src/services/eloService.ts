import { PrismaClient } from '@prisma/client';
import { RankSystem } from '../utils/rankSystem';
import { AntiFarmingProtection } from '../utils/antiFarmingProtection';

export interface EloUpdateResult {
  winnerId: string;
  loserId: string;
  winnerOldElo: number;
  loserOldElo: number;
  winnerNewElo: number;
  loserNewElo: number;
  winnerEloChange: number;
  loserEloChange: number;
  kFactor: number;
  expectedScore: number;
  actualScore: number;
}

export interface BattleResult {
  roomId: string;
  winnerId: string;
  loserId: string;
  endTime: Date;
  reason: 'hp_depleted' | 'forfeit' | 'timeout' | 'disconnection';
  battleDuration: number; // in seconds
  totalSubmissions: number;
  averageAccuracy: number;
}

export class EloService {
  private prisma: PrismaClient;
  private readonly K_FACTOR = 32;
  private antiFarmingProtection: AntiFarmingProtection;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.antiFarmingProtection = new AntiFarmingProtection(prisma);
  }

  async updateEloAfterBattle(battleResult: BattleResult): Promise<EloUpdateResult> {
    const { winnerId, loserId } = battleResult;

    try {
      // Check anti-farming restrictions
      const winnerCheck = await this.antiFarmingProtection.canBattle(winnerId, loserId);
      const loserCheck = await this.antiFarmingProtection.canBattle(loserId, winnerId);
      
      if (!winnerCheck.allowed || !loserCheck.allowed) {
        throw new Error(`Battle not allowed: ${winnerCheck.reason || loserCheck.reason}`);
      }

      // Get current ELO ratings with all required fields
      const winner = await this.prisma.user.findUnique({
        where: { id: winnerId },
        select: { 
          id: true, 
          elo: true, 
          seasonalElo: true,
          rankTier: true,
          username: true 
        }
      });

      const loser = await this.prisma.user.findUnique({
        where: { id: loserId },
        select: { 
          id: true, 
          elo: true, 
          seasonalElo: true,
          rankTier: true,
          username: true 
        }
      });

      if (!winner || !loser) {
        throw new Error('User not found for ELO update');
      }

      const winnerOldElo = winner.elo;
      const loserOldElo = loser.elo;
      const winnerOldSeasonalElo = winner.seasonalElo;
      const loserOldSeasonalElo = loser.seasonalElo;

      // Calculate expected scores
      const expectedWinnerScore = this.calculateExpectedScore(winnerOldElo, loserOldElo);
      const expectedLoserScore = this.calculateExpectedScore(loserOldElo, winnerOldElo);

      // Actual scores (1 for win, 0 for loss)
      const actualWinnerScore = 1;
      const actualLoserScore = 0;

      // Calculate ELO changes
      const winnerEloChange = Math.round(this.K_FACTOR * (actualWinnerScore - expectedWinnerScore));
      const loserEloChange = Math.round(this.K_FACTOR * (actualLoserScore - expectedLoserScore));

      const winnerNewElo = RankSystem.applyMinimumElo(winnerOldElo + winnerEloChange);
      const loserNewElo = RankSystem.applyMinimumElo(loserOldElo + loserEloChange);
      
      const winnerNewSeasonalElo = RankSystem.applyMinimumElo(winnerOldSeasonalElo + winnerEloChange);
      const loserNewSeasonalElo = RankSystem.applyMinimumElo(loserOldSeasonalElo + loserEloChange);

      // Get new rank tiers
      const winnerNewRankTier = RankSystem.getRankByElo(winnerNewElo).tier;
      const loserNewRankTier = RankSystem.getRankByElo(loserNewElo).tier;

      // Update ELO in database
      await this.prisma.user.update({
        where: { id: winnerId },
        data: {
          elo: winnerNewElo,
          seasonalElo: winnerNewSeasonalElo,
          rankTier: winnerNewRankTier,
          wins: { increment: 1 },
          winStreak: { increment: 1 }
        }
      });

      await this.prisma.user.update({
        where: { id: loserId },
        data: {
          elo: loserNewElo,
          seasonalElo: loserNewSeasonalElo,
          rankTier: loserNewRankTier,
          losses: { increment: 1 },
          winStreak: 0 // Reset win streak on loss
        }
      });

      // Record battle completion for anti-farming tracking
      await this.antiFarmingProtection.recordBattleCompletion(winnerId, loserId);
      await this.antiFarmingProtection.recordBattleCompletion(loserId, winnerId);

      const result: EloUpdateResult = {
        winnerId,
        loserId,
        winnerOldElo,
        loserOldElo,
        winnerNewElo,
        loserNewElo,
        winnerEloChange,
        loserEloChange,
        kFactor: this.K_FACTOR,
        expectedScore: expectedWinnerScore,
        actualScore: actualWinnerScore,
      };

      console.log(`ELO updated: ${winner.username} ${winnerOldElo}→${winnerNewElo} (+${winnerEloChange}) [${winner.rankTier}→${winnerNewRankTier}], ${loser.username} ${loserOldElo}→${loserNewElo} (${loserEloChange}) [${loser.rankTier}→${loserNewRankTier}]`);

      return result;

    } catch (error) {
      console.error('Error updating ELO:', error);
      throw error;
    }
  }

  async updateEloAfterDraw(player1Id: string, player2Id: string): Promise<[EloUpdateResult, EloUpdateResult]> {
    try {
      // Get current ELO ratings
      const player1 = await this.prisma.user.findUnique({
        where: { id: player1Id },
        select: { 
          id: true, 
          elo: true, 
          seasonalElo: true,
          rankTier: true,
          username: true 
        }
      });

      const player2 = await this.prisma.user.findUnique({
        where: { id: player2Id },
        select: { 
          id: true, 
          elo: true, 
          seasonalElo: true,
          rankTier: true,
          username: true 
        }
      });

      if (!player1 || !player2) {
        throw new Error('User not found for ELO update');
      }

      const player1OldElo = player1.elo;
      const player2OldElo = player2.elo;
      const player1OldSeasonalElo = player1.seasonalElo;
      const player2OldSeasonalElo = player2.seasonalElo;

      // Calculate expected scores
      const expectedPlayer1Score = this.calculateExpectedScore(player1OldElo, player2OldElo);
      const expectedPlayer2Score = this.calculateExpectedScore(player2OldElo, player1OldElo);

      // Actual scores (0.5 for draw)
      const actualScore = 0.5;

      // Calculate ELO changes
      const player1EloChange = Math.round(this.K_FACTOR * (actualScore - expectedPlayer1Score));
      const player2EloChange = Math.round(this.K_FACTOR * (actualScore - expectedPlayer2Score));

      const player1NewElo = RankSystem.applyMinimumElo(player1OldElo + player1EloChange);
      const player2NewElo = RankSystem.applyMinimumElo(player2OldElo + player2EloChange);
      
      const player1NewSeasonalElo = RankSystem.applyMinimumElo(player1OldSeasonalElo + player1EloChange);
      const player2NewSeasonalElo = RankSystem.applyMinimumElo(player2OldSeasonalElo + player2EloChange);

      // Get new rank tiers
      const player1NewRankTier = RankSystem.getRankByElo(player1NewElo).tier;
      const player2NewRankTier = RankSystem.getRankByElo(player2NewElo).tier;

      // Update ELO in database
      await this.prisma.user.update({
        where: { id: player1Id },
        data: {
          elo: player1NewElo,
          seasonalElo: player1NewSeasonalElo,
          rankTier: player1NewRankTier,
        }
      });

      await this.prisma.user.update({
        where: { id: player2Id },
        data: {
          elo: player2NewElo,
          seasonalElo: player2NewSeasonalElo,
          rankTier: player2NewRankTier,
        }
      });

      const result1: EloUpdateResult = {
        winnerId: player1Id,
        loserId: player2Id,
        winnerOldElo: player1OldElo,
        loserOldElo: player2OldElo,
        winnerNewElo: player1NewElo,
        loserNewElo: player2NewElo,
        winnerEloChange: player1EloChange,
        loserEloChange: player2EloChange,
        kFactor: this.K_FACTOR,
        expectedScore: expectedPlayer1Score,
        actualScore,
      };

      const result2: EloUpdateResult = {
        winnerId: player2Id,
        loserId: player1Id,
        winnerOldElo: player2OldElo,
        loserOldElo: player1OldElo,
        winnerNewElo: player2NewElo,
        loserNewElo: player1NewElo,
        winnerEloChange: player2EloChange,
        loserEloChange: player1EloChange,
        kFactor: this.K_FACTOR,
        expectedScore: expectedPlayer2Score,
        actualScore,
      };

      console.log(`ELO draw: ${player1.username} ${player1OldElo}→${player1NewElo} (${player1EloChange}) [${player1.rankTier}→${player1NewRankTier}], ${player2.username} ${player2OldElo}→${player2NewElo} (${player2EloChange}) [${player2.rankTier}→${player2NewRankTier}]`);

      return [result1, result2];

    } catch (error) {
      console.error('Error updating ELO for draw:', error);
      throw error;
    }
  }

  private calculateExpectedScore(playerElo: number, opponentElo: number): number {
    return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  }

  async getUserEloHistory(userId: string, limit: number = 20): Promise<any[]> {
    try {
      const matches = await this.prisma.match.findMany({
        where: {
          OR: [
            { player1Id: userId },
            { player2Id: userId }
          ],
          status: 'COMPLETED',
          winnerId: { not: null } // Only completed matches with winners
        },
        orderBy: { endedAt: 'desc' },
        take: limit,
        include: {
          player1: { select: { username: true, elo: true } },
          player2: { select: { username: true, elo: true } },
          winner: { select: { username: true } }
        }
      });

      return matches.map(match => {
        const isPlayer1 = match.player1Id === userId;
        const opponent = isPlayer1 ? match.player2 : match.player1;
        const playerElo = isPlayer1 ? match.player1.elo : match.player2.elo;
        const opponentElo = isPlayer1 ? match.player2.elo : match.player1.elo;
        const won = match.winnerId === userId;

        return {
          matchId: match.id,
          opponent: opponent.username,
          opponentElo: opponentElo,
          playerElo: playerElo,
          result: won ? 'win' : 'loss',
          endedAt: match.endedAt,
        };
      });

    } catch (error) {
      console.error('Error getting ELO history:', error);
      return [];
    }
  }

  async getLeaderboard(limit: number = 50): Promise<any[]> {
    try {
      const users = await this.prisma.user.findMany({
        orderBy: { elo: 'desc' },
        take: limit,
        select: {
          id: true,
          username: true,
          elo: true,
          seasonalElo: true,
          rankTier: true,
          wins: true,
          losses: true,
          createdAt: true,
        }
      });

      // Calculate win rate and other stats
      return users.map((user, index) => {
        const rankInfo = RankSystem.getRankByElo(user.elo);
        return {
          rank: index + 1,
          id: user.id,
          username: user.username,
          elo: user.elo,
          seasonalElo: user.seasonalElo,
          rankTier: user.rankTier,
          wins: user.wins,
          losses: user.losses,
          totalGames: user.wins + user.losses,
          winRate: user.wins + user.losses > 0 ? (user.wins / (user.wins + user.losses)) * 100 : 0,
          joinedAt: user.createdAt,
          rankInfo: rankInfo
        };
      });

    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  async getEloDistribution(): Promise<any> {
    try {
      const users = await this.prisma.user.findMany({
        select: { elo: true }
      });

      const distribution = {
        '0-1199': 0, // Bronze
        '1200-1399': 0, // Silver
        '1400-1599': 0, // Gold
        '1600-1799': 0, // Platinum
        '1800-1999': 0, // Diamond
        '2000+': 0, // Master
      };

      users.forEach(user => {
        const elo = user.elo;
        if (elo < 1200) distribution['0-1199']++;
        else if (elo < 1400) distribution['1200-1399']++;
        else if (elo < 1600) distribution['1400-1599']++;
        else if (elo < 1800) distribution['1600-1799']++;
        else if (elo < 2000) distribution['1800-1999']++;
        else distribution['2000+']++;
      });

      return distribution;

    } catch (error) {
      console.error('Error getting ELO distribution:', error);
      return {};
    }
  }

  validateEloRange(elo: number): boolean {
    return RankSystem.isValidElo(elo);
  }

  getKFactor(): number {
    return this.K_FACTOR;
  }

  // For debugging and analysis
  async simulateEloChange(playerElo: number, opponentElo: number, playerWon: boolean): Promise<number> {
    const expectedScore = this.calculateExpectedScore(playerElo, opponentElo);
    const actualScore = playerWon ? 1 : 0;
    return Math.round(this.K_FACTOR * (actualScore - expectedScore));
  }

  // Get seasonal leaderboard
  async getSeasonalLeaderboard(limit: number = 50): Promise<any[]> {
    try {
      const users = await this.prisma.user.findMany({
        orderBy: { seasonalElo: 'desc' },
        take: limit,
        select: {
          id: true,
          username: true,
          seasonalElo: true,
          rankTier: true,
          wins: true,
          losses: true,
        }
      });

      return users.map((user, index) => {
        const rankInfo = RankSystem.getRankByElo(user.seasonalElo);
        return {
          rank: index + 1,
          id: user.id,
          username: user.username,
          seasonalElo: user.seasonalElo,
          rankTier: user.rankTier,
          wins: user.wins,
          losses: user.losses,
          totalGames: user.wins + user.losses,
          winRate: user.wins + user.losses > 0 ? (user.wins / (user.wins + user.losses)) * 100 : 0,
          rankInfo: rankInfo
        };
      });

    } catch (error) {
      console.error('Error getting seasonal leaderboard:', error);
      return [];
    }
  }

  // Check if two players can match based on ELO and rank restrictions
  canPlayersMatch(player1Elo: number, player2Elo: number): boolean {
    return RankSystem.canMatch(player1Elo, player2Elo);
  }

  // Get rank progress for a user
  async getUserRankProgress(userId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { elo: true, rankTier: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentRank = RankSystem.getRankByElo(user.elo);
      const progress = RankSystem.getRankProgress(user.elo);
      const nextTierElo = RankSystem.getEloForNextTier(user.elo);
      const maintainElo = RankSystem.getEloToMaintainTier(user.elo);

      return {
        currentElo: user.elo,
        currentRank: currentRank,
        progress: progress,
        nextTierElo: nextTierElo,
        maintainElo: maintainElo,
        eloToNextTier: nextTierElo ? nextTierElo - user.elo : 0
      };
    } catch (error) {
      console.error('Error getting user rank progress:', error);
      return null;
    }
  }
}
