export declare class UserService {
    static getUserById(userId: string): Promise<{
        username: string;
        email: string;
        id: string;
        elo: number;
        wins: number;
        losses: number;
        createdAt: Date;
    } | null>;
    static getUserByEmail(email: string): Promise<{
        username: string;
        email: string;
        id: string;
        passwordHash: string;
        elo: number;
        wins: number;
        losses: number;
        createdAt: Date;
    } | null>;
    static updateUserElo(userId: string, newElo: number): Promise<{
        username: string;
        id: string;
        elo: number;
        wins: number;
        losses: number;
    }>;
    static incrementWins(userId: string): Promise<{
        username: string;
        id: string;
        elo: number;
        wins: number;
        losses: number;
    }>;
    static incrementLosses(userId: string): Promise<{
        username: string;
        id: string;
        elo: number;
        wins: number;
        losses: number;
    }>;
    static getLeaderboard(limit?: number): Promise<{
        username: string;
        id: string;
        elo: number;
        wins: number;
        losses: number;
    }[]>;
    static createUser(userData: {
        username: string;
        email: string;
        passwordHash: string;
    }): Promise<{
        username: string;
        email: string;
        id: string;
        elo: number;
        wins: number;
        losses: number;
        createdAt: Date;
    }>;
    static updateBattleStats(winnerId: string, loserId: string, winnerEloChange: number, loserEloChange: number): Promise<{
        winner: {
            username: string;
            id: string;
            elo: number;
            wins: number;
            losses: number;
        };
        loser: {
            username: string;
            id: string;
            elo: number;
            wins: number;
            losses: number;
        };
    }>;
}
//# sourceMappingURL=userService.d.ts.map