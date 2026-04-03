import { prisma } from '../lib/prisma';

const PROBLEM_SELECT = {
  id: true, title: true, description: true,
  difficulty: true, timeLimitMs: true, memoryLimitMb: true,
  p50RuntimeMs: true, tags: true, examples: true,
  testCases: true, createdAt: true,
};

function parseProblem(p: any) {
  if (!p) return p;
  return {
    ...p,
    tags: typeof p.tags === 'string' ? JSON.parse(p.tags) : (p.tags || []),
    examples: typeof p.examples === 'string' ? JSON.parse(p.examples) : (p.examples || []),
    testCases: typeof p.testCases === 'string' ? JSON.parse(p.testCases) : (p.testCases || []),
  };
}

export class ProblemService {
  static async getAllProblems() {
    const ps = await prisma.problem.findMany({
      select: { ...PROBLEM_SELECT, testCases: false },
      orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
    });
    return ps.map(parseProblem);
  }

  static async getProblemById(id: string) {
    return parseProblem(await prisma.problem.findUnique({ where: { id }, select: PROBLEM_SELECT }));
  }

  static async getRandomProblem() {
    const problems = await prisma.problem.findMany({ select: PROBLEM_SELECT });
    if (!problems.length) return null;
    return parseProblem(problems[Math.floor(Math.random() * problems.length)]);
  }

  static async getProblemsByDifficulty(difficulty: string) {
    const ps = await prisma.problem.findMany({
      where: { difficulty },
      select: PROBLEM_SELECT,
    });
    return ps.map(parseProblem);
  }

  static async createProblem(data: {
    title: string; description: string; difficulty: string;
    timeLimitMs: number; memoryLimitMb: number; p50RuntimeMs?: number;
    tags: any; examples: any; testCases: any;
  }) {
    const row = await prisma.problem.create({
      data: {
        ...data,
        tags: JSON.stringify(data.tags),
        examples: JSON.stringify(data.examples),
        testCases: JSON.stringify(data.testCases),
      } as any,
      select: PROBLEM_SELECT,
    });
    return parseProblem(row);
  }
}
