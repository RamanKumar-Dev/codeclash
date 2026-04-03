"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const prisma_1 = require("../lib/prisma");
class UserService {
    // Get user by ID
    static async getUserById(userId) {
        return prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                elo: true,
                wins: true,
                losses: true,
                createdAt: true,
            }
        });
    }
    // Get user by email
    static async getUserByEmail(email) {
        return prisma_1.prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                username: true,
                email: true,
                passwordHash: true,
                elo: true,
                wins: true,
                losses: true,
                createdAt: true,
            }
        });
    }
    // Update user ELO
    static async updateUserElo(userId, newElo) {
        return prisma_1.prisma.user.update({
            where: { id: userId },
            data: { elo: newElo },
            select: {
                id: true,
                username: true,
                elo: true,
                wins: true,
                losses: true,
            }
        });
    }
    // Increment wins
    static async incrementWins(userId) {
        return prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                wins: { increment: 1 },
            },
            select: {
                id: true,
                username: true,
                elo: true,
                wins: true,
                losses: true,
            }
        });
    }
    // Increment losses
    static async incrementLosses(userId) {
        return prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                losses: { increment: 1 },
            },
            select: {
                id: true,
                username: true,
                elo: true,
                wins: true,
                losses: true,
            }
        });
    }
    // Get leaderboard
    static async getLeaderboard(limit = 20) {
        return prisma_1.prisma.user.findMany({
            take: limit,
            orderBy: { elo: 'desc' },
            select: {
                id: true,
                username: true,
                elo: true,
                wins: true,
                losses: true,
            }
        });
    }
    // Create user
    static async createUser(userData) {
        return prisma_1.prisma.user.create({
            data: {
                ...userData,
                elo: 1000,
                wins: 0,
                losses: 0,
            },
            select: {
                id: true,
                username: true,
                email: true,
                elo: true,
                wins: true,
                losses: true,
                createdAt: true,
            }
        });
    }
    // Update user stats after battle
    static async updateBattleStats(winnerId, loserId, winnerEloChange, loserEloChange) {
        const [winner, loser] = await Promise.all([
            prisma_1.prisma.user.update({
                where: { id: winnerId },
                data: {
                    elo: { increment: winnerEloChange },
                    wins: { increment: 1 },
                },
                select: {
                    id: true,
                    username: true,
                    elo: true,
                    wins: true,
                    losses: true,
                }
            }),
            prisma_1.prisma.user.update({
                where: { id: loserId },
                data: {
                    elo: { increment: loserEloChange },
                    losses: { increment: 1 },
                },
                select: {
                    id: true,
                    username: true,
                    elo: true,
                    wins: true,
                    losses: true,
                }
            })
        ]);
        return { winner, loser };
    }
}
exports.UserService = UserService;
//# sourceMappingURL=userService.js.map