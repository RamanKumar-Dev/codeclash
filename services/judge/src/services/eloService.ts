import { PrismaClient } from '@prisma/client';

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

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async updateEloAfterBattle(battleResult: BattleResult): Promise<EloUpdateResult> {
    const { winnerId, loserId } = battleResult;

    try {
      // Get current ELO ratings
      const winner = await this.prisma.user.findUnique({
        where: { id: winnerId },
        select: { id: true, rank: true, username: true }
      });

      const loser = await this.prisma.user.findUnique({
        where: { id: loserId },
        select: { id: true, rank: true, username: true }
      });

      if (!winner || !loser) {
        throw new Error('User not found for ELO update');
      }

      const winnerOldElo = winner.rank;
      const loserOldElo = loser.rank;

      // Calculate expected scores
      const expectedWinnerScore = this.calculateExpectedScore(winnerOldElo, loserOldElo);
      const expectedLoserScore = this.calculateExpectedScore(loserOldElo, winnerOldElo);

      // Actual scores (1 for win, 0 for loss)
      const actualWinnerScore = 1;
      const actualLoserScore = 0;

      // Calculate ELO changes
      const winnerEloChange = Math.round(this.K_FACTOR * (actualWinnerScore - expectedWinnerScore));
      const loserEloChange = Math.round(this.K_FACTOR * (actualLoserScore - expectedLoserScore));

      // Update ELO in database
      await this.prisma.user.update({
        where: { id: winnerId },
        data: {
          rank: winnerOldElo + winnerEloChange,
          // Update win count
          wins: { increment: 1 }
        }
      });

      await this.prisma.user.update({
        where: { id: loserId },
        data: {
          rank: loserOldElo + loserEloChange,
          // Update loss count
          losses: { increment: 1 }
        }
      });

      const result: EloUpdateResult = {
        winnerId,
        loserId,
        winnerOldElo,
        loserOldElo,
        winnerNewElo: winnerOldElo + winnerEloChange,
        loserNewElo: loserOldElo + loserEloChange,
        winnerEloChange,
        loserEloChange,
        kFactor: this.K_FACTOR,
        expectedScore: expectedWinnerScore,
        actualScore: actualWinnerScore,
      };

      console.log(`ELO updated: ${winner.username} ${winnerOldElo}→${result.winnerNewElo} (+${winnerEloChange}), ${loser.username} ${loserOldElo}→${result.loserNewElo} (${loserEloChange})`);

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
        select: { id: true, rank: true, username: true }
      });

      const player2 = await this.prisma.user.findUnique({
        where: { id: player2Id },
        select: { id: true, rank: true, username: true }
      });

      if (!player1 || !player2) {
        throw new Error('User not found for ELO update');
      }

      const player1OldElo = player1.rank;
      const player2OldElo = player2.rank;

      // Calculate expected scores
      const expectedPlayer1Score = this.calculateExpectedScore(player1OldElo, player2OldElo);
      const expectedPlayer2Score = this.calculateExpectedScore(player2OldElo, player1OldElo);

      // Actual scores (0.5 for draw)
      const actualScore = 0.5;

      // Calculate ELO changes
      const player1EloChange = Math.round(this.K_FACTOR * (actualScore - expectedPlayer1Score));
      const player2EloChange = Math.round(this.K_FACTOR * (actualScore - expectedPlayer2Score));

      // Update ELO in database
      await this.prisma.user.update({
        where: { id: player1Id },
        data: {
          rank: player1OldElo + player1EloChange,
        }
      });

      await this.prisma.user.update({
        where: { id: player2Id },
        data: {
          rank: player2OldElo + player2EloChange,
        }
      });

      const result1: EloUpdateResult = {
        winnerId: player1Id,
        loserId: player2Id,
        winnerOldElo: player1OldElo,
        loserOldElo: player2OldElo,
        winnerNewElo: player1OldElo + player1EloChange,
        loserNewElo: player2OldElo + player2EloChange,
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
        winnerNewElo: player2OldElo + player2EloChange,
        loserNewElo: player1OldElo + player1EloChange,
        winnerEloChange: player2EloChange,
        loserEloChange: player1EloChange,
        kFactor: this.K_FACTOR,
        expectedScore: expectedPlayer2Score,
        actualScore,
      };

      console.log(`ELO draw: ${player1.username} ${player1OldElo}→${result1.winnerNewElo} (${player1EloChange}), ${player2.username} ${player2OldElo}→${result2.winnerNewElo} (${player2EloChange})`);

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
          player1: { select: { username: true, rank: true } },
          player2: { select: { username: true, rank: true } },
          winner: { select: { username: true } }
        }
      });

      return matches.map(match => {
        const isPlayer1 = match.player1Id === userId;
        const opponent = isPlayer1 ? match.player2 : match.player1;
        const playerElo = isPlayer1 ? match.player1.rank : match.player2.rank;
        const opponentElo = isPlayer1 ? match.player2.rank : match.player1.rank;
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
        orderBy: { rank: 'desc' },
        take: limit,
        select: {
          id: true,
          username: true,
          rank: true,
          wins: true,
          losses: true,
          createdAt: true,
        }
      });

      // Calculate win rate and other stats
      return users.map((user, index) => ({
        rank: index + 1,
        id: user.id,
        username: user.username,
        elo: user.rank,
        wins: user.wins,
        losses: user.losses,
        totalGames: user.wins + user.losses,
        winRate: user.wins + user.losses > 0 ? (user.wins / (user.wins + user.losses)) * 100 : 0,
        joinedAt: user.createdAt,
      }));

    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  async getEloDistribution(): Promise<any> {
    try {
      const users = await this.prisma.user.findMany({
        select: { rank: true }
      });

      const distribution = {
        '0-1000': 0,
        '1000-1200': 0,
        '1200-1400': 0,
        '1400-1600': 0,
        '1600-1800': 0,
        '1800-2000': 0,
        '2000+': 0,
      };

      users.forEach(user => {
        const elo = user.rank;
        if (elo < 1000) distribution['0-1000']++;
        else if (elo < 1200) distribution['1000-1200']++;
        else if (elo < 1400) distribution['1200-1400']++;
        else if (elo < 1600) distribution['1400-1600']++;
        else if (elo < 1800) distribution['1600-1800']++;
        else if (elo < 2000) distribution['1800-2000']++;
        else distribution['2000+']++;
      });

      return distribution;

    } catch (error) {
      console.error('Error getting ELO distribution:', error);
      return {};
    }
  }

  validateEloRange(elo: number): boolean {
    return elo >= 0 && elo <= 5000; // Reasonable ELO bounds
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
}
