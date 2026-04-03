export declare class ProblemService {
    static getAllProblems(): Promise<{
        id: string;
        createdAt: Date;
        title: string;
        description: string;
        difficulty: string;
        timeLimitMs: number;
        memoryLimitMb: number;
        tags: string[];
    }[]>;
    static getProblemById(problemId: string): Promise<{
        id: string;
        createdAt: Date;
        title: string;
        description: string;
        difficulty: string;
        timeLimitMs: number;
        memoryLimitMb: number;
        tags: string[];
    } | null>;
    static getRandomProblem(): Promise<{
        id: string;
        title: string;
        description: string;
        difficulty: string;
        timeLimitMs: number;
        memoryLimitMb: number;
        tags: string[];
    } | null>;
    static createProblem(problemData: {
        title: string;
        description: string;
        difficulty: string;
        timeLimitMs: number;
        memoryLimitMb: number;
        tags: string[];
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        difficulty: string;
        testCases: import("@prisma/client/runtime/library").JsonValue;
        timeLimitMs: number;
        memoryLimitMb: number;
        tags: string[];
        examples: import("@prisma/client/runtime/library").JsonValue;
    }>;
    static getProblemsByDifficulty(difficulty: string): Promise<{
        id: string;
        createdAt: Date;
        title: string;
        description: string;
        difficulty: string;
        timeLimitMs: number;
        memoryLimitMb: number;
        tags: string[];
    }[]>;
    static updateProblem(problemId: string, updateData: Partial<{
        title: string;
        description: string;
        difficulty: string;
        timeLimitMs: number;
        memoryLimitMb: number;
        tags: string[];
    }>): Promise<{
        id: string;
        updatedAt: Date;
        title: string;
        description: string;
        difficulty: string;
        timeLimitMs: number;
        memoryLimitMb: number;
        tags: string[];
    }>;
    static deleteProblem(problemId: string): Promise<{
        id: string;
        title: string;
    }>;
}
//# sourceMappingURL=problemService.d.ts.map