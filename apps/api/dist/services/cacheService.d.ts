import { RedisClientType } from 'redis';
export interface CacheOptions {
    ttl?: number;
    tags?: string[];
}
export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalKeys: number;
}
export declare class CacheService {
    private redis;
    private stats;
    constructor(redis: RedisClientType);
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
    del(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    private addTags;
    invalidateByTag(tag: string): Promise<void>;
    invalidateByTags(tags: string[]): Promise<void>;
    getStats(): CacheStats;
    resetStats(): void;
    warmCache(): Promise<void>;
    flushAll(): Promise<void>;
}
export declare class PuzzleCacheService {
    private cache;
    private readonly PUZZLE_TTL;
    private readonly LEADERBOARD_TTL;
    private readonly PROFILE_TTL;
    constructor(cache: CacheService);
    getPuzzle(id: string): Promise<any | null>;
    setPuzzle(id: string, puzzle: any): Promise<void>;
    invalidatePuzzle(id: string): Promise<void>;
    getPuzzleList(filters: any): Promise<any[] | null>;
    setPuzzleList(filters: any, puzzles: any[]): Promise<void>;
    getLeaderboard(type?: string): Promise<any[] | null>;
    setLeaderboard(type: string, leaderboard: any[]): Promise<void>;
    invalidateLeaderboard(type?: string): Promise<void>;
    getUserProfile(userId: string): Promise<any | null>;
    setUserProfile(userId: string, profile: any): Promise<void>;
    invalidateUserProfile(userId: string): Promise<void>;
    getUserStats(userId: string): Promise<any | null>;
    setUserStats(userId: string, stats: any): Promise<void>;
    invalidateUserStats(userId: string): Promise<void>;
    getQueueSize(): Promise<number | null>;
    setQueueSize(size: number): Promise<void>;
    getBattleRoom(roomId: string): Promise<any | null>;
    setBattleRoom(roomId: string, room: any): Promise<void>;
    invalidateBattleRoom(roomId: string): Promise<void>;
    getPopularPuzzles(): Promise<any[] | null>;
    setPopularPuzzles(puzzles: any[]): Promise<void>;
    getRecentSubmissions(userId: string, limit?: number): Promise<any[] | null>;
    setRecentSubmissions(userId: string, submissions: any[], limit?: number): Promise<void>;
    invalidateUserSubmissions(userId: string): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        details: any;
    }>;
}
export declare function cacheMiddleware(ttl?: number, keyGenerator?: (req: any) => string): (req: any, res: any, next: any) => Promise<any>;
export declare function cacheInvalidationMiddleware(tags: string[]): (req: any, res: any, next: any) => Promise<void>;
//# sourceMappingURL=cacheService.d.ts.map