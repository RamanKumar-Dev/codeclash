export interface PuzzleExample {
    input: string;
    output: string;
    explanation?: string;
}
export interface TestCase {
    input: string;
    output: string;
    isHidden: boolean;
    weight: number;
}
export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    elo: number;
    seasonElo: number;
    role: 'user' | 'admin' | 'moderator';
    isVerified: boolean;
    verificationToken?: string;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    refreshTokens: string[];
    friends: string[];
    pendingRequests: string[];
    isOnline: boolean;
    lastActiveAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface Season {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    createdAt: Date;
}
export interface EloHistory {
    id: string;
    userId: string;
    seasonId: string;
    elo: number;
    timestamp: Date;
    battleId?: string;
}
export interface SeasonBadge {
    id: string;
    userId: string;
    seasonId: string;
    rank: number;
    badgeType: 'gold' | 'silver' | 'bronze';
    awardedAt: Date;
}
export interface Battle {
    id: string;
    roomId: string;
    player1Id: string;
    player2Id: string;
    status: 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'JUDGING' | 'COMPLETED' | 'ERROR' | 'ABANDONED';
    puzzleId: string;
    puzzleVersion: number;
    winnerId?: string;
    battleType: 'ranked' | 'casual' | 'private';
    player1Hp: number;
    player2Hp: number;
    player1Spells: SpellState[];
    player2Spells: SpellState[];
    currentRound: number;
    maxRounds: number;
    startTime?: Date;
    endTime?: Date;
    lastActivityAt: Date;
    errorReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Puzzle {
    id: string;
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: string;
    constraints: string;
    examples: PuzzleExample[];
    testCases: TestCase[];
    version: number;
    isActive: boolean;
    benchmarks: Record<string, PuzzleBenchmark>;
    avgSolveTimeSeconds: number;
    solveRate: number;
    submissionCount: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface PuzzleBenchmark {
    puzzleId: string;
    language: string;
    p50RuntimeMs: number;
    p95RuntimeMs: number;
    avgMemoryKb: number;
    sampleSize: number;
    lastUpdated: Date;
}
export interface SpellState {
    spellId: string;
    lastUsedAt?: Date;
    cooldownUntil?: Date;
    usesRemaining: number;
}
export interface PrivateRoom {
    id: string;
    roomCode: string;
    createdBy: string;
    maxPlayers: number;
    currentPlayers: string[];
    spectators: string[];
    settings: PrivateRoomSettings;
    status: 'waiting' | 'active' | 'completed';
    expiresAt: Date;
    createdAt: Date;
}
export interface PrivateRoomSettings {
    battleType: 'ranked' | 'casual';
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
    timeLimit: number;
    maxSpectators: number;
}
export interface LiveBattle {
    battleId: string;
    roomId: string;
    player1: BattlePlayer;
    player2: BattlePlayer;
    puzzleTitle: string;
    status: string;
    spectatorCount: number;
    isFeatured: boolean;
    startedAt: Date;
}
export interface BattlePlayer {
    userId: string;
    username: string;
    elo: number;
    hp: number;
    progress: number;
    currentCode?: string;
}
