import { prisma } from '../lib/prisma';

export class MatchService {
  // Create match
  static async createMatch(matchData: {
    player1Id: string;
    player2Id: string;
    problemId: string;
  }) {
    return prisma.match.create({
      data: {
        ...matchData,
        status: 'waiting',
        currentRound: 1,
      },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        problem: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            timeLimitMs: true,
          }
        }
      }
    });
  }

  // Get match by ID
  static async getMatchById(matchId: string) {
    return prisma.match.findUnique({
      where: { id: matchId },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        problem: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            timeLimitMs: true,
          }
        },
        submissions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  // Start match
  static async startMatch(matchId: string) {
    return prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'active',
        startedAt: new Date(),
      },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        }
      }
    });
  }

  // End match
  static async endMatch(matchId: string, winnerId: string) {
    return prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'completed',
        winnerId,
        endedAt: new Date(),
      },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        winner: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        }
      }
    });
  }

  // Get matches by user
  static async getMatchesByUser(userId: string, limit: number = 10) {
    return prisma.match.findMany({
      where: {
        OR: [
          { player1Id: userId },
          { player2Id: userId }
        ]
      },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        problem: {
          select: {
            id: true,
            title: true,
            difficulty: true,
          }
        },
        winner: {
          select: {
            id: true,
            username: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  // Get active matches
  static async getActiveMatches() {
    return prisma.match.findMany({
      where: { status: 'active' },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo: true,
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

  // Update match status
  static async updateMatchStatus(matchId: string, status: string) {
    return prisma.match.update({
      where: { id: matchId },
      data: { status },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo: true,
          }
        }
      }
    });
  }
}
