import { prisma } from '../lib/prisma';

export class ProblemService {
  // Get all problems
  static async getAllProblems() {
    return prisma.problem.findMany({
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
  static async getProblemById(problemId: string) {
    return prisma.problem.findUnique({
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
    const problems = await prisma.problem.findMany({
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
  static async createProblem(problemData: {
    title: string;
    description: string;
    difficulty: string;
    timeLimitMs: number;
    memoryLimitMb: number;
    tags: string[];
  }) {
    return prisma.problem.create({
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
  static async getProblemsByDifficulty(difficulty: string) {
    return prisma.problem.findMany({
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
  static async updateProblem(problemId: string, updateData: Partial<{
    title: string;
    description: string;
    difficulty: string;
    timeLimitMs: number;
    memoryLimitMb: number;
    tags: string[];
  }>) {
    return prisma.problem.update({
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
  static async deleteProblem(problemId: string) {
    return prisma.problem.delete({
      where: { id: problemId },
      select: {
        id: true,
        title: true,
      }
    });
  }
}
