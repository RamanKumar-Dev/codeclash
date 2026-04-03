import { prisma } from '../lib/prisma';

export class UserService {
  static async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, email: true,
        elo: true, wins: true, losses: true,
        winStreak: true, spellsCast: true,
        hp: true, maxHp: true, avatar: true,
        createdAt: true,
      },
    });
  }

  static async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true, username: true, email: true,
        passwordHash: true, elo: true,
        wins: true, losses: true, winStreak: true,
        spellsCast: true, createdAt: true,
      },
    });
  }

  static async getLeaderboard(limit: number = 50) {
    return prisma.user.findMany({
      take: limit,
      orderBy: { elo: 'desc' },
      select: {
        id: true, username: true, elo: true,
        wins: true, losses: true, winStreak: true,
        avatar: true,
      },
    });
  }

  static async createUser(data: {
    username: string;
    email: string;
    passwordHash: string;
  }) {
    return prisma.user.create({
      data: { ...data, elo: 1000, wins: 0, losses: 0 },
      select: {
        id: true, username: true, email: true,
        elo: true, wins: true, losses: true,
        createdAt: true,
      },
    });
  }

  static async updateBattleStats(
    winnerId: string,
    loserId: string,
    winnerEloChange: number,
    loserEloChange: number
  ) {
    const [winner, loser] = await Promise.all([
      prisma.user.update({
        where: { id: winnerId },
        data: { elo: { increment: winnerEloChange }, wins: { increment: 1 } },
        select: { id: true, username: true, elo: true, wins: true, losses: true },
      }),
      prisma.user.update({
        where: { id: loserId },
        data: { elo: { increment: loserEloChange }, losses: { increment: 1 } },
        select: { id: true, username: true, elo: true, wins: true, losses: true },
      }),
    ]);
    return { winner, loser };
  }

  static async incrementWinStreak(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { winStreak: { increment: 1 } },
    });
  }

  static async resetWinStreak(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { winStreak: 0 },
    });
  }

  static async incrementSpellsCast(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { spellsCast: { increment: 1 } },
    });
  }

  static async updateUserElo(userId: string, newElo: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { elo: newElo },
    });
  }
}
