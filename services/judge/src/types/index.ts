export interface Judge0Language {
  id: number;
  name: string;
  extension: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
}

export interface ExecutionRequest {
  code: string;
  language: string;
  puzzleId: string;
  userId: string;
  roomId: string;
  submissionId?: string;
}

export interface ExecutionResult {
  passed: number;
  total: number;
  runtime_ms: number;
  memory_kb: number;
  statusCode: number;
  statusDescription: string;
  testCaseResults: TestCaseResult[];
  correctnessRatio: number;
}

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  runtime_ms: number;
  memory_kb: number;
  statusCode: number;
  statusDescription: string;
}

export interface DamageCalculation {
  baseDamage: number;
  speedMultiplier: number;
  efficiencyBonus: number;
  allPassBonus: number;
  firstSolveBonus: number;
  totalDamage: number;
  partialDamage: number;
  cappedDamage: number;
}

export interface BattleDamageResult {
  userId: string;
  roomId: string;
  damage: number;
  executionResult: ExecutionResult;
  damageBreakdown: DamageCalculation;
  opponentHp: number;
  isBattleOver: boolean;
  winner?: string;
}

export interface PuzzleBenchmark {
  puzzleId: string;
  p50_runtime_ms: number;
  language: string;
  sampleSize: number;
  updatedAt: Date;
}

export interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  max_cpu_time?: number;
  max_memory?: number;
  wall_time_limit?: number;
}

export interface Judge0Result {
  token: string;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  message?: string;
  status: {
    id: number;
    description: string;
  };
  created_at: string;
  finished_at?: string;
  time?: string;
  memory?: number;
  expected_output?: string; // Added for compatibility
}
