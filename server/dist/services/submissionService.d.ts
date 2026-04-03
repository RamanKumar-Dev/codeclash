export declare class SubmissionService {
    static createSubmission(submissionData: {
        matchId: string;
        userId: string;
        problemId: string;
        code: string;
        language: string;
        passedTests: number;
        totalTests: number;
        execTimeMs: number;
        damageDealt: number;
    }): Promise<{
        user: {
            username: string;
            id: string;
        };
        problem: {
            id: string;
            title: string;
            difficulty: string;
        };
    } & {
        id: string;
        createdAt: Date;
        code: string;
        userId: string;
        problemId: string;
        language: string;
        passedTests: number;
        totalTests: number;
        execTimeMs: number;
        damageDealt: number;
        matchId: string;
    }>;
    static getSubmissionsByMatch(matchId: string): Promise<({
        user: {
            username: string;
            id: string;
        };
    } & {
        id: string;
        createdAt: Date;
        code: string;
        userId: string;
        problemId: string;
        language: string;
        passedTests: number;
        totalTests: number;
        execTimeMs: number;
        damageDealt: number;
        matchId: string;
    })[]>;
    static getSubmissionsByUser(userId: string, limit?: number): Promise<({
        match: {
            id: string;
            status: string;
            winnerId: string | null;
        };
        problem: {
            id: string;
            title: string;
            difficulty: string;
        };
    } & {
        id: string;
        createdAt: Date;
        code: string;
        userId: string;
        problemId: string;
        language: string;
        passedTests: number;
        totalTests: number;
        execTimeMs: number;
        damageDealt: number;
        matchId: string;
    })[]>;
    static getLatestSubmissionForUser(matchId: string, userId: string): Promise<({
        user: {
            username: string;
            id: string;
        };
    } & {
        id: string;
        createdAt: Date;
        code: string;
        userId: string;
        problemId: string;
        language: string;
        passedTests: number;
        totalTests: number;
        execTimeMs: number;
        damageDealt: number;
        matchId: string;
    }) | null>;
    static getUserSubmissionStats(userId: string): Promise<import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.SubmissionGroupByOutputType, "userId"[]> & {
        _count: {
            id: number;
        };
        _avg: {
            passedTests: number | null;
            totalTests: number | null;
            execTimeMs: number | null;
            damageDealt: number | null;
        };
        _max: {
            damageDealt: number | null;
        };
    }>;
    static getProblemStats(problemId: string): Promise<import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.SubmissionGroupByOutputType, "problemId"[]> & {
        _count: {
            id: number;
        };
        _avg: {
            passedTests: number | null;
            totalTests: number | null;
            execTimeMs: number | null;
            damageDealt: number | null;
        };
    }>;
    static updateSubmission(submissionId: string, updateData: Partial<{
        code: string;
        language: string;
        passedTests: number;
        totalTests: number;
        execTimeMs: number;
        damageDealt: number;
    }>): Promise<{
        user: {
            username: string;
            id: string;
        };
        problem: {
            id: string;
            title: string;
            difficulty: string;
        };
    } & {
        id: string;
        createdAt: Date;
        code: string;
        userId: string;
        problemId: string;
        language: string;
        passedTests: number;
        totalTests: number;
        execTimeMs: number;
        damageDealt: number;
        matchId: string;
    }>;
    static deleteSubmission(submissionId: string): Promise<{
        id: string;
        userId: string;
        problemId: string;
    }>;
}
//# sourceMappingURL=submissionService.d.ts.map