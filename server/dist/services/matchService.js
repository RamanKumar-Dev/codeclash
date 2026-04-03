"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchService = void 0;
const prisma_1 = require("../lib/prisma");
class MatchService {
    // Create match
    static async createMatch(matchData) {
        return prisma_1.prisma.match.create({
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
    static async getMatchById(matchId) {
        return prisma_1.prisma.match.findUnique({
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
    static async startMatch(matchId) {
        return prisma_1.prisma.match.update({
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
    static async endMatch(matchId, winnerId) {
        return prisma_1.prisma.match.update({
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
    static async getMatchesByUser(userId, limit = 10) {
        return prisma_1.prisma.match.findMany({
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
        return prisma_1.prisma.match.findMany({
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
    static async updateMatchStatus(matchId, status) {
        return prisma_1.prisma.match.update({
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
exports.MatchService = MatchService;
//# sourceMappingURL=matchService.js.map