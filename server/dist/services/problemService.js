"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProblemService = void 0;
const prisma_1 = require("../lib/prisma");
class ProblemService {
    // Get all problems
    static async getAllProblems() {
        return prisma_1.prisma.problem.findMany({
            select: {
                id: true,
                title: true,
                description: true,
                difficulty: true,
                timeLimitMs: true,
                memoryLimitMb: true,
                tags: true,
                createdAt: true,
            }
        });
    }
    // Get problem by ID
    static async getProblemById(problemId) {
        return prisma_1.prisma.problem.findUnique({
            where: { id: problemId },
            select: {
                id: true,
                title: true,
                description: true,
                difficulty: true,
                timeLimitMs: true,
                memoryLimitMb: true,
                tags: true,
                createdAt: true,
            }
        });
    }
    // Get random problem
    static async getRandomProblem() {
        const problems = await prisma_1.prisma.problem.findMany({
            select: {
                id: true,
                title: true,
                description: true,
                difficulty: true,
                timeLimitMs: true,
                memoryLimitMb: true,
                tags: true,
            }
        });
        if (problems.length === 0) {
            return null;
        }
        const randomIndex = Math.floor(Math.random() * problems.length);
        return problems[randomIndex];
    }
    // Create problem
    static async createProblem(problemData) {
        return prisma_1.prisma.problem.create({
            data: problemData,
            select: {
                id: true,
                title: true,
                description: true,
                difficulty: true,
                timeLimitMs: true,
                memoryLimitMb: true,
                tags: true,
                createdAt: true,
            }
        });
    }
    // Get problems by difficulty
    static async getProblemsByDifficulty(difficulty) {
        return prisma_1.prisma.problem.findMany({
            where: { difficulty },
            select: {
                id: true,
                title: true,
                description: true,
                difficulty: true,
                timeLimitMs: true,
                memoryLimitMb: true,
                tags: true,
                createdAt: true,
            }
        });
    }
    // Update problem
    static async updateProblem(problemId, updateData) {
        return prisma_1.prisma.problem.update({
            where: { id: problemId },
            data: updateData,
            select: {
                id: true,
                title: true,
                description: true,
                difficulty: true,
                timeLimitMs: true,
                memoryLimitMb: true,
                tags: true,
                updatedAt: true,
            }
        });
    }
    // Delete problem
    static async deleteProblem(problemId) {
        return prisma_1.prisma.problem.delete({
            where: { id: problemId },
            select: {
                id: true,
                title: true,
            }
        });
    }
}
exports.ProblemService = ProblemService;
//# sourceMappingURL=problemService.js.map