export declare class MatchService {
    static createMatch(matchData: {
        player1Id: string;
        player2Id: string;
        problemId: string;
    }): Promise<{
        problem: {
            id: string;
            title: string;
            description: string;
            difficulty: string;
            timeLimitMs: number;
        };
        player1: {
            username: string;
            id: string;
            elo: number;
        };
        player2: {
            username: string;
            id: string;
            elo: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        player1Id: string;
        status: string;
        startedAt: Date | null;
        endedAt: Date | null;
        currentRound: number;
        player2Id: string;
        problemId: string;
        winnerId: string | null;
    }>;
    static getMatchById(matchId: string): Promise<({
        problem: {
            id: string;
            title: string;
            description: string;
            difficulty: string;
            timeLimitMs: number;
        };
        submissions: ({
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
        })[];
        player1: {
            username: string;
            id: string;
            elo: number;
        };
        player2: {
            username: string;
            id: string;
            elo: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        player1Id: string;
        status: string;
        startedAt: Date | null;
        endedAt: Date | null;
        currentRound: number;
        player2Id: string;
        problemId: string;
        winnerId: string | null;
    }) | null>;
    static startMatch(matchId: string): Promise<{
        player1: {
            username: string;
            id: string;
            elo: number;
        };
        player2: {
            username: string;
            id: string;
            elo: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        player1Id: string;
        status: string;
        startedAt: Date | null;
        endedAt: Date | null;
        currentRound: number;
        player2Id: string;
        problemId: string;
        winnerId: string | null;
    }>;
    static endMatch(matchId: string, winnerId: string): Promise<{
        winner: {
            username: string;
            id: string;
            elo: number;
        } | null;
        player1: {
            username: string;
            id: string;
            elo: number;
        };
        player2: {
            username: string;
            id: string;
            elo: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        player1Id: string;
        status: string;
        startedAt: Date | null;
        endedAt: Date | null;
        currentRound: number;
        player2Id: string;
        problemId: string;
        winnerId: string | null;
    }>;
    static getMatchesByUser(userId: string, limit?: number): Promise<({
        problem: {
            id: string;
            title: string;
            difficulty: string;
        };
        winner: {
            username: string;
            id: string;
        } | null;
        player1: {
            username: string;
            id: string;
            elo: number;
        };
        player2: {
            username: string;
            id: string;
            elo: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        player1Id: string;
        status: string;
        startedAt: Date | null;
        endedAt: Date | null;
        currentRound: number;
        player2Id: string;
        problemId: string;
        winnerId: string | null;
    })[]>;
    static getActiveMatches(): Promise<({
        problem: {
            id: string;
            title: string;
            difficulty: string;
        };
        player1: {
            username: string;
            id: string;
            elo: number;
        };
        player2: {
            username: string;
            id: string;
            elo: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        player1Id: string;
        status: string;
        startedAt: Date | null;
        endedAt: Date | null;
        currentRound: number;
        player2Id: string;
        problemId: string;
        winnerId: string | null;
    })[]>;
    static updateMatchStatus(matchId: string, status: string): Promise<{
        player1: {
            username: string;
            id: string;
            elo: number;
        };
        player2: {
            username: string;
            id: string;
            elo: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        player1Id: string;
        status: string;
        startedAt: Date | null;
        endedAt: Date | null;
        currentRound: number;
        player2Id: string;
        problemId: string;
        winnerId: string | null;
    }>;
}
//# sourceMappingURL=matchService.d.ts.map