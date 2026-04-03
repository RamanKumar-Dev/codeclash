import { PrismaClient } from '@prisma/client';
import { RedisClientType } from 'redis';
import { Season, EloHistory, SeasonBadge } from '@code-clash/shared-types';
export interface SeasonConfig {
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
}
export declare class SeasonalSystem {
    private redis;
    private prisma;
    private currentSeason;
    constructor(redis: RedisClientType, prisma: PrismaClient);
    initialize(): Promise<void>;
    private loadCurrentSeason;
    createSeason(config: SeasonConfig): Promise<Season>;
    recordEloSnapshot(userId: string, battleId?: string): Promise<void>;
    getEloHistory(userId: string): Promise<EloHistory[]>;
    updateSeasonalElo(userId: string, newElo: number): Promise<void>;
    private updateSeasonalLeaderboard;
    getSeasonalLeaderboard(limit?: number): Promise<any[]>;
    endSeason(seasonId: string): Promise<void>;
    private resetSeasonalElo;
    applyEloDecay(): Promise<void>;
    private clearSeasonalData;
    private scheduleSeasonalTasks;
    private resetWeeklyLeaderboard;
    private checkSeasonEnd;
    getUserSeasonalBadges(userId: string): Promise<SeasonBadge[]>;
    getCurrentSeason(): Season | null;
    updateUserActivity(userId: string): Promise<void>;
}
//# sourceMappingURL=seasonalSystem.d.ts.map