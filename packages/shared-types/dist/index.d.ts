export interface User {
    id: string;
    username: string;
    email: string;
    xp: number;
    rank: number;
    tokens: number;
    elo: number;
    battlesWon: number;
    battlesLost: number;
    spellsUnlocked: string[];
    seasonalElo: number;
    seasonRank?: number;
    seasonBadges: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateUserRequest {
    username: string;
    email: string;
    password: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}
export interface Problem {
    id: string;
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    testCases: TestCase[];
    timeLimitMs: number;
    memoryLimitMb: number;
    tags: string[];
}
export interface TestCase {
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
}
export interface Match {
    id: string;
    player1Id: string;
    player2Id: string;
    problemId: string;
    status: 'waiting' | 'active' | 'completed';
    winnerId?: string;
    startedAt?: Date;
    endedAt?: Date;
    currentRound: number;
}
export interface MatchState {
    match: Match;
    player1: User;
    player2: User;
    problem: Problem;
    player1Hp: number;
    player2Hp: number;
    currentTurn: 'player1' | 'player2';
    roundStartTime: Date;
}
export interface Submission {
    id: string;
    matchId: string;
    userId: string;
    problemId: string;
    code: string;
    language: string;
    passedTests: number;
    totalTests: number;
    execTimeMs: number;
    damageDealt: number;
    createdAt: Date;
}
export interface SubmitCodeRequest {
    code: string;
    language: string;
}
export interface JudgeResult {
    passed: number;
    total: number;
    execTimeMs: number;
    output?: string;
    stderr?: string;
    compileError?: string;
}
export interface Spell {
    spellId: string;
    name: string;
    icon: string;
    description: string;
    cooldownSeconds: number;
    unlockCondition: UnlockCondition;
    effect: SpellEffect;
}
export interface UnlockCondition {
    type: 'battles_won' | 'elo_reached';
    value: number;
}
export interface SpellEffect {
    type: 'oracle_hint' | 'time_freeze' | 'tower_shield' | 'debug_ray' | 'double_damage' | 'code_wipe';
    duration?: number;
    value?: number;
}
export interface SpellCastRequest {
    spellId: string;
    roomId: string;
    targetUserId?: string;
}
export interface SpellCastResult {
    success: boolean;
    spellId: string;
    casterId: string;
    effect: SpellEffect;
    cooldownUntil: Date;
    error?: string;
}
export interface SpellUnlockNotification {
    spellId: string;
    spell: Spell;
    userId: string;
}
export interface ActiveSpellEffect {
    spellId: string;
    casterId: string;
    targetId?: string;
    effect: SpellEffect;
    expiresAt: Date;
    isActive: boolean;
}
export interface SpellUse {
    spellType: 'hint' | 'time_freeze' | 'slow';
    targetUserId?: string;
}
export interface QueueEntry {
    userId: string;
    username: string;
    elo: number;
    joinedAt: Date;
    preferences: {
        difficulty?: 'easy' | 'medium' | 'hard';
        timeLimit?: number;
        languages?: string[];
    };
}
export interface MatchmakingRequest {
    userId: string;
    elo: number;
    preferences?: QueueEntry['preferences'];
}
export interface MatchmakingResponse {
    success: boolean;
    queueSize?: number;
    estimatedWaitTime?: number;
    error?: string;
}
export type BattleState = 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'JUDGING' | 'ENDED';
export interface BattleRoom {
    id: string;
    player1Id: string;
    player2Id: string;
    puzzleId: string;
    state: BattleState;
    startedAt?: Date;
    endedAt?: Date;
    timeLimit: number;
    currentRound: number;
}
export interface BattleParticipant {
    userId: string;
    username: string;
    elo: number;
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    submissions: number;
    lastActivity: Date;
    isDisconnected: boolean;
}
export interface BattleStateData {
    room: BattleRoom;
    player1: BattleParticipant;
    player2: BattleParticipant;
    puzzle: Problem;
    timeRemaining: number;
    currentTurn: string;
}
export interface DamageLog {
    id: string;
    sourcePlayer: string;
    targetPlayer: string;
    damage: number;
    type: 'puzzle' | 'spell';
    timestamp: Date;
    details?: any;
}
export interface BattleStats {
    winner: string;
    loser: string;
    duration: number;
    totalSubmissions: number;
    damageLog: DamageLog[];
    eloChange: {
        winner: number;
        loser: number;
    };
    rewards: {
        winner: {
            xp: number;
            tokens: number;
        };
        loser: {
            xp: number;
            tokens: number;
        };
    };
}
export interface ClientToServerEvents {
    'queue:join': (data: MatchmakingRequest) => void;
    'queue:leave': () => void;
    'queue:status': () => void;
    'battle:submit': (data: {
        code: string;
        language: string;
        roomId: string;
    }) => void;
    'battle:spell_cast': (data: SpellCastRequest) => void;
    'battle:forfeit': (data: {
        roomId: string;
    }) => void;
    'battle:ready': (data: {
        roomId: string;
    }) => void;
    'battle:reconnect': (data: {
        roomId: string;
    }) => void;
    'battle:ping': () => void;
    join_queue: () => void;
    leave_queue: () => void;
    submit_code: (data: SubmitCodeRequest) => void;
    use_spell: (spell: SpellUse) => void;
}
export interface ServerToClientEvents {
    'queue:joined': (data: {
        queueSize: number;
        estimatedWaitTime: number;
    }) => void;
    'queue:left': () => void;
    'queue:status': (data: {
        queueSize: number;
        estimatedWaitTime: number;
    }) => void;
    'match:found': (data: {
        roomId: string;
        opponent: BattleParticipant;
        puzzle: Problem;
    }) => void;
    'battle:start': (data: {
        puzzle: Problem;
        timeLimit: number;
        opponentName: string;
        opponentElo: number;
    }) => void;
    'battle:opponent_progress': (data: {
        linesChanged: number;
        submissionCount: number;
    }) => void;
    'battle:damage': (data: {
        sourcePlayer: string;
        damage: number;
        targetHP: number;
        attackAnimation: string;
    }) => void;
    'battle:spell_used': (data: SpellCastResult) => void;
    'battle:time_warning': (data: {
        secondsLeft: number;
    }) => void;
    'battle:end': (data: {
        winner: string;
        loser: string;
        damageLog: DamageLog[];
        eloChange: any;
        rewards: any;
    }) => void;
    'battle:reconnecting': (data: {
        opponentId: string;
    }) => void;
    'battle:opponent_reconnected': () => void;
    'battle:countdown': (data: {
        seconds: number;
    }) => void;
    'battle:state_update': (data: BattleStateData) => void;
    'spell:unlocked': (data: SpellUnlockNotification) => void;
    match_found: (data: MatchState) => void;
    damage_dealt: (data: {
        attacker: string;
        damage: number;
        opponentHp: number;
    }) => void;
    spell_used: (data: {
        caster: string;
        spellType: string;
        effect: any;
    }) => void;
    match_over: (data: {
        winner: string;
        xpGained: number;
        rankChange: number;
    }) => void;
    queue_update: (data: {
        queueSize: number;
    }) => void;
    error: (message: string) => void;
}
export declare const REDIS_KEYS: {
    readonly QUEUE: "matchmaking:queue";
    readonly BATTLE_ROOM: "battle:room:";
    readonly BATTLE_STATE: "battle:state:";
    readonly USER_SESSION: "user:session:";
    readonly BATTLE_PARTICIPANTS: "battle:participants:";
    readonly USER_BATTLE: "user:battle:";
    readonly SPELL_COOLDOWN: "spell:cooldown:";
    readonly ACTIVE_SPELLS: "spell:active:";
};
export declare const MATCHMAKING_CONFIG: {
    readonly INITIAL_ELO_WINDOW: 200;
    readonly ELO_WINDOW_EXPANSION: 50;
    readonly WINDOW_EXPANSION_INTERVAL: 10000;
    readonly MAX_ELO_WINDOW: 500;
    readonly SCAN_INTERVAL: 2000;
    readonly QUEUE_TIMEOUT: 300000;
    readonly BATTLE_TIMEOUT: 1800000;
    readonly RECONNECT_TIMEOUT: 30000;
};
export interface LeaderboardEntry {
    userId: string;
    username: string;
    xp: number;
    rank: number;
}
export interface LeaderboardResponse {
    entries: LeaderboardEntry[];
    userRank?: LeaderboardEntry;
    season: string;
}
export type SupportedLanguage = 'javascript' | 'python' | 'java' | 'cpp';
export declare const LANGUAGE_CONFIG: Record<SupportedLanguage, {
    name: string;
    extension: string;
    dockerImage: string;
    runCommand: string;
    compileCommand?: string;
}>;
export interface Season {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    rewards: SeasonReward[];
    topPlayers: SeasonTopPlayer[];
    createdAt: Date;
    updatedAt: Date;
}
export interface SeasonReward {
    rank: number;
    rewardType: 'badge' | 'tokens' | 'xp' | 'title';
    value: string | number;
    description: string;
}
export interface SeasonTopPlayer {
    userId: string;
    username: string;
    rank: number;
    elo: number;
    battlesWon: number;
    rewards: SeasonReward[];
}
export interface RankTier {
    name: string;
    icon: string;
    color: string;
    minElo: number;
    maxElo: number;
    borderColor: string;
    bgColor: string;
}
export declare const RANK_TIERS: Record<string, RankTier>;
export interface LeaderboardEntry {
    userId: string;
    username: string;
    rank: number;
    elo: number;
    battlesWon: number;
    battlesLost: number;
    winRate: number;
    rankTier: RankTier;
    avatar?: string;
    isCurrentUser?: boolean;
}
export interface LeaderboardResponse {
    entries: LeaderboardEntry[];
    userRank?: LeaderboardEntry;
    currentSeason?: Season;
    totalPages: number;
    currentPage: number;
    totalPlayers: number;
}
export interface LeaderboardQuery {
    type: 'season' | 'alltime' | 'weekly';
    page?: number;
    limit?: number;
    search?: string;
}
export interface SeasonSummary {
    season: Season;
    userRank?: number;
    userElo: number;
    userRewards: SeasonReward[];
    eloJourney: {
        date: Date;
        elo: number;
    }[];
    nextSeasonStart: Date;
}
export declare const LEADERBOARD_KEYS: {
    readonly SEASON: (seasonId: string) => string;
    readonly ALLTIME: "leaderboard:alltime";
    readonly WEEKLY: "leaderboard:weekly";
    readonly USER_RANK: (userId: string, type: string) => string;
    readonly SEASON_INFO: "season:current";
    readonly ELO_JOURNEY: (userId: string, seasonId: string) => string;
};
