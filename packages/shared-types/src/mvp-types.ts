// MVP-focused simplified types
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  elo: number;
  wins: number;
  losses: number;
  createdAt: Date;
}

export interface Battle {
  id: string;
  roomId: string;
  player1Id: string;
  player2Id: string;
  puzzleId: string;
  winnerId?: string;
  eloChange?: number;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
}

export interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3;
  examples: PuzzleExample[];
  testCases: TestCase[];
  timeLimitSeconds: number;
  p50RuntimeMs: number;
}

export interface PuzzleExample {
  input: string;
  output: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface BattleState {
  player1Id: string;
  player2Id: string;
  hp1: number;
  hp2: number;
  startTimestamp: number;
  status: 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'JUDGING' | 'ENDED';
  sub1Count: number;
  sub2Count: number;
}

// MVP WebSocket Events
export interface MatchFoundEvent {
  roomId: string;
  opponentName: string;
  puzzle: Puzzle;
  timeLimitSeconds: number;
}

export interface BattleDamageEvent {
  attackerName: string;
  damage: number;
  hp1: number;
  hp2: number;
}

export interface BattleEndEvent {
  winnerId: string;
  winnerName: string;
  finalHp1: number;
  finalHp2: number;
  eloChange: number;
}

export interface QueueJoinEvent {
  userId: string;
}

export interface BattleSubmitEvent {
  code: string;
  languageId: number;
  roomId: string;
}

export interface BattleForfeitEvent {
  roomId: string;
}

// MVP Socket Events
export interface ClientToServerEvents {
  'queue:join': (data: QueueJoinEvent) => void;
  'battle:submit': (data: BattleSubmitEvent) => void;
  'battle:forfeit': (data: BattleForfeitEvent) => void;
}

export interface ServerToClientEvents {
  'match:found': (data: MatchFoundEvent) => void;
  'battle:countdown': (data: { secondsLeft: number }) => void;
  'battle:start': () => void;
  'battle:opponent_activity': (data: { submissionCount: number }) => void;
  'battle:damage': (data: BattleDamageEvent) => void;
  'battle:time_warning': (data: { secondsLeft: number }) => void;
  'battle:end': (data: BattleEndEvent) => void;
}
