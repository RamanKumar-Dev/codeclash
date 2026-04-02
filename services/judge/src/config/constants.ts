import { Judge0Language } from '../types';

export const LANGUAGE_MAPPING: Record<string, number> = {
  'python': 71,
  'javascript': 63,
  'cpp': 54,
  'java': 62,
  'go': 60,
  'py': 71,
  'js': 63,
  'c++': 54,
  'ts': 63, // TypeScript maps to JavaScript
};

export const SUPPORTED_LANGUAGES: Judge0Language[] = [
  { id: 71, name: 'Python', extension: '.py' },
  { id: 63, name: 'JavaScript', extension: '.js' },
  { id: 54, name: 'C++', extension: '.cpp' },
  { id: 62, name: 'Java', extension: '.java' },
  { id: 60, name: 'Go', extension: '.go' },
];

export const JUDGE0_CONFIG = {
  BASE_URL: process.env.JUDGE0_URL || 'http://localhost:2358',
  API_URL: process.env.JUDGE0_API_URL || 'http://localhost:2358',
  TIMEOUT_MS: 10000, // 10 seconds for polling
  POLL_INTERVAL_MS: 500, // 500ms polling interval
  MAX_POLL_ATTEMPTS: 20,
};

export const EXECUTION_LIMITS = {
  CPU_TIME_LIMIT: 5, // 5 seconds per test case (increased for security)
  MEMORY_LIMIT: 256, // 256MB
  WALL_TIME_LIMIT: 5, // 5 seconds wall time
  MAX_OUTPUT_SIZE: 65536, // 64KB (reduced for security)
};

export const DAMAGE_CONFIG = {
  BASE_DAMAGE: 20,
  MAX_DAMAGE: 70,
  PARTIAL_DAMAGE_PER_TEST: 2,
  EFFICIENCY_BONUS: 10,
  ALL_PASS_BONUS: 15,
  FIRST_SOLVE_BONUS: 25,
  STARTING_HP: 500,
  SPEED_MIN_MULTIPLIER: 0.5,
};

export const JUDGE0_STATUS_CODES = {
  QUEUED: 1,
  PROCESSING: 2,
  SUCCESS: 3,
  WRONG_ANSWER: 4,
  RUNTIME_ERROR: 5,
  TIME_LIMIT_EXCEEDED: 6,
  COMPILATION_ERROR: 7,
  MEMORY_LIMIT_EXCEEDED: 8,
  INTERNAL_ERROR: 9,
  ACCEPTED: 3, // Same as SUCCESS
};

export function getLanguageId(language: string): number {
  const normalizedLang = language.toLowerCase();
  const langId = LANGUAGE_MAPPING[normalizedLang];
  
  if (!langId) {
    throw new Error(`Unsupported language: ${language}. Supported languages: ${Object.keys(LANGUAGE_MAPPING).join(', ')}`);
  }
  
  return langId;
}

export function getLanguageName(languageId: number): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.id === languageId);
  return lang?.name || 'Unknown';
}

export function isSuccessfulExecution(statusId: number): boolean {
  return statusId === JUDGE0_STATUS_CODES.SUCCESS || statusId === JUDGE0_STATUS_CODES.ACCEPTED;
}

export function getExecutionLimits(language: string) {
  // Language-specific limits can be added here
  const limits = { ...EXECUTION_LIMITS };
  
  // For example, give more time for compiled languages
  if (['java', 'cpp', 'go'].includes(language.toLowerCase())) {
    limits.CPU_TIME_LIMIT = 3; // 3 seconds for compiled languages
  }
  
  return limits;
}
