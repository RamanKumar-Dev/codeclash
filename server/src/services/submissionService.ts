import { prisma } from '../lib/prisma';

export class SubmissionService {
  // Create submission
  static async createSubmission(submissionData: {
    matchId: string;
    userId: string;
    problemId: string;
    code: string;
    language: string;
    passedTests: number;
    totalTests: number;
    execTimeMs: number;
    damageDealt: number;
  }) {
    return prisma.submission.create({
      data: submissionData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          }
        },
        problem: {
          select: {
            id: true,
            title: true,
            difficulty: true,
          }
        }
      }
    });
  }

  // Get submissions by match
  static async getSubmissionsByMatch(matchId: string) {
    return prisma.submission.findMany({
      where: { matchId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Get submissions by user
  static async getSubmissionsByUser(userId: string, limit: number = 10) {
    return prisma.submission.findMany({
      where: { userId },
      include: {
        match: {
          select: {
            id: true,
            status: true,
            winnerId: true,
          }
        },
        problem: {
          select: {
            id: true,
            title: true,
            difficulty: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  // Get latest submission for user in match
  static async getLatestSubmissionForUser(matchId: string, userId: string) {
    return prisma.submission.findFirst({
      where: {
        matchId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Get submission statistics for user
  static async getUserSubmissionStats(userId: string) {
    const stats = await prisma.submission.groupBy({
      by: ['userId'],
      where: { userId },
      _count: {
        id: true,
      },
      _avg: {
        passedTests: true,
        totalTests: true,
        execTimeMs: true,
        damageDealt: true,
      },
      _max: {
        damageDealt: true,
      }
    });

    return stats[0] || null;
  }

  // Get problem statistics
  static async getProblemStats(problemId: string) {
    const stats = await prisma.submission.groupBy({
      by: ['problemId'],
      where: { problemId },
      _count: {
        id: true,
      },
      _avg: {
        passedTests: true,
        totalTests: true,
        execTimeMs: true,
        damageDealt: true,
      }
    });

    return stats[0] || null;
  }

  // Update submission
  static async updateSubmission(submissionId: string, updateData: Partial<{
    code: string;
    language: string;
    passedTests: number;
    totalTests: number;
    execTimeMs: number;
    damageDealt: number;
  }>) {
    return prisma.submission.update({
      where: { id: submissionId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          }
        },
        problem: {
          select: {
            id: true,
            title: true,
            difficulty: true,
          }
        }
      }
    });
  }

  // Delete submission
  static async deleteSubmission(submissionId: string) {
    return prisma.submission.delete({
      where: { id: submissionId },
      select: {
        id: true,
        userId: true,
        problemId: true,
      }
    });
  }
}
