"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionService = void 0;
const prisma_1 = require("../lib/prisma");
class SubmissionService {
    // Create submission
    static async createSubmission(submissionData) {
        return prisma_1.prisma.submission.create({
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
    static async getSubmissionsByMatch(matchId) {
        return prisma_1.prisma.submission.findMany({
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
    static async getSubmissionsByUser(userId, limit = 10) {
        return prisma_1.prisma.submission.findMany({
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
    static async getLatestSubmissionForUser(matchId, userId) {
        return prisma_1.prisma.submission.findFirst({
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
    static async getUserSubmissionStats(userId) {
        const stats = await prisma_1.prisma.submission.groupBy({
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
    static async getProblemStats(problemId) {
        const stats = await prisma_1.prisma.submission.groupBy({
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
    static async updateSubmission(submissionId, updateData) {
        return prisma_1.prisma.submission.update({
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
    static async deleteSubmission(submissionId) {
        return prisma_1.prisma.submission.delete({
            where: { id: submissionId },
            select: {
                id: true,
                userId: true,
                problemId: true,
            }
        });
    }
}
exports.SubmissionService = SubmissionService;
//# sourceMappingURL=submissionService.js.map