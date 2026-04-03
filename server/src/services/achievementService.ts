import { prisma } from '../lib/prisma';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  wins: number;
  losses: number;
  winStreak: number;
  battleDurationMs?: number;
  damageReceived?: number;
  spellsCast?: number;
  firstWin?: boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Win your very first battle',
    icon: '⚔️',
    condition: (s) => s.firstWin === true,
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Win 10 battles',
    icon: '🏅',
    condition: (s) => s.wins >= 10,
  },
  {
    id: 'champion',
    name: 'Champion',
    description: 'Win 25 battles',
    icon: '🏆',
    condition: (s) => s.wins >= 25,
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Win a battle in under 60 seconds',
    icon: '⚡',
    condition: (s) => (s.battleDurationMs || Infinity) < 60000,
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    description: 'Win a battle without taking any damage',
    icon: '🛡️',
    condition: (s) => s.damageReceived === 0 && (s.wins > 0 || s.firstWin),
  },
  {
    id: 'comeback-kid',
    name: 'Comeback Kid',
    description: 'Win 5 battles in a row',
    icon: '🔥',
    condition: (s) => s.winStreak >= 5,
  },
  {
    id: 'wizard',
    name: 'Wizard',
    description: 'Cast 10 spells in total',
    icon: '🪄',
    condition: (s) => (s.spellsCast || 0) >= 10,
  },
];

export class AchievementService {
  /**
   * Check and grant new achievements to a user after a battle
   */
  static async checkAndGrant(
    userId: string,
    stats: AchievementStats
  ): Promise<Achievement[]> {
    const newlyEarned: Achievement[] = [];

    // Get already-earned achievement IDs
    const existing = await prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    const earnedIds = new Set(existing.map(e => e.achievementId));

    for (const achievement of ACHIEVEMENTS) {
      if (!earnedIds.has(achievement.id) && achievement.condition(stats)) {
        try {
          await prisma.userAchievement.create({
            data: {
              userId,
              achievementId: achievement.id,
              achievementName: achievement.name,
              achievementIcon: achievement.icon,
            },
          });
          newlyEarned.push(achievement);
        } catch (err) {
          // Already exists (race condition) — ignore
        }
      }
    }

    return newlyEarned;
  }

  /**
   * Get all achievements for a user
   */
  static async getUserAchievements(userId: string) {
    return prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
    });
  }

  /**
   * Get all achievement definitions (for the UI)
   */
  static getAllDefinitions() {
    return ACHIEVEMENTS.map(({ id, name, description, icon }) => ({
      id, name, description, icon,
    }));
  }
}
