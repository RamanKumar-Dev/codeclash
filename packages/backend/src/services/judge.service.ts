import axios from 'axios';
import { redisService } from './redis.service';
import { SupportedLanguage, LANGUAGE_CONFIG } from '@code-clash/shared-types';

export interface JudgeSubmission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  max_cpu_time?: number;
  max_memory?: number;
  wall_time_limit?: number;
  additional_files?: string;
  compile_limit?: number;
}

export interface JudgeResult {
  token: string;
  compile_output?: string;
  runtime_memory?: number;
  runtime_status?: string;
  runtime_stderr?: string;
  runtime_stdout?: string;
  runtime_time?: number;
  compile_memory?: number;
  compile_status?: string;
  compile_stderr?: string;
  compile_time?: number;
  status?: {
    id: number;
    description: string;
  };
}

export class JudgeService {
  private readonly JUDGE0_URL: string;
  private readonly RATE_LIMIT_KEY = 'judge:rate_limit:';
  private readonly MAX_SUBMISSIONS_PER_MINUTE = 10;

  constructor() {
    this.JUDGE0_URL = process.env.JUDGE0_URL || 'http://localhost:3002';
  }

  async submitCode(
    userId: string,
    code: string,
    language: SupportedLanguage,
    stdin?: string,
    expectedOutput?: string
  ): Promise<JudgeResult> {
    // Rate limiting check
    await this.checkRateLimit(userId);

    // Security: Validate and sanitize input
    const sanitizedCode = this.sanitizeCode(code, language);
    
    const submission: JudgeSubmission = {
      source_code: sanitizedCode,
      language_id: this.getLanguageId(language),
      stdin: stdin || '',
      expected_output: expectedOutput || '',
      max_cpu_time: 5, // 5 seconds
      max_memory: 256000, // 256MB in KB
      wall_time_limit: 10, // 10 seconds wall time
      compile_limit: 10 // 10 seconds compile time
    };

    try {
      const response = await axios.post(`${this.JUDGE0_URL}/submissions`, submission, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId
        },
        timeout: 30000 // 30 second timeout
      });

      const token = response.data.token;
      
      // Store submission token for tracking
      await redisService.set(`submission:${token}`, JSON.stringify({
        userId,
        language,
        submittedAt: new Date().toISOString()
      }), 'EX', 300); // Keep for 5 minutes

      return response.data;
    } catch (error) {
      console.error('Judge submission failed:', error);
      throw new Error('Failed to submit code to judge service');
    }
  }

  async getSubmissionResult(token: string): Promise<JudgeResult> {
    try {
      const response = await axios.get(`${this.JUDGE0_URL}/submissions/${token}`, {
        timeout: 10000
      });

      const result = response.data;
      
      // Update submission record with result
      const submissionKey = `submission:${token}`;
      const existing = await redisService.get(submissionKey);
      if (existing) {
        const submissionData = JSON.parse(existing);
        await redisService.set(submissionKey, JSON.stringify({
          ...submissionData,
          result,
          completedAt: new Date().toISOString()
        }), 'EX', 300);
      }

      return result;
    } catch (error) {
      console.error('Failed to get submission result:', error);
      throw new Error('Failed to retrieve submission result');
    }
  }

  async waitForResult(token: string, maxWaitTime: number = 30000): Promise<JudgeResult> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getSubmissionResult(token);
      
      // Check if submission is completed
      if (result.status?.id >= 3) { // Status ID >= 3 means completed
        return result;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Submission timed out');
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const key = `${this.RATE_LIMIT_KEY}${userId}`;
    const current = await redisService.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= this.MAX_SUBMISSIONS_PER_MINUTE) {
      const ttl = await redisService.ttl(key);
      throw new Error(`Rate limit exceeded. Try again in ${ttl} seconds.`);
    }

    // Increment counter with 60-second TTL
    await redisService.incr(key);
    if (count === 0) {
      await redisService.expire(key, 60);
    }
  }

  private sanitizeCode(code: string, language: SupportedLanguage): string {
    // Security: Remove potentially dangerous code patterns
    const dangerousPatterns = this.getDangerousPatterns(language);
    
    let sanitizedCode = code;
    
    for (const pattern of dangerousPatterns) {
      // Remove or replace dangerous patterns
      sanitizedCode = sanitizedCode.replace(new RegExp(pattern, 'gi'), '// REMOVED_FOR_SECURITY');
    }

    // Additional security checks
    if (this.containsSuspiciousCode(sanitizedCode, language)) {
      throw new Error('Code contains potentially dangerous operations');
    }

    return sanitizedCode;
  }

  private getDangerousPatterns(language: SupportedLanguage): string[] {
    const patterns = {
      python: [
        'os\\.system',
        'subprocess\\.',
        'sys\\.exit',
        'exec\\(',
        'eval\\(',
        '__import__',
        'open\\(',
        'file\\(',
        'input\\(',
        'raw_input\\(',
        'compile\\(',
        'globals\\(',
        'locals\\(',
        'vars\\(',
        'dir\\(',
        'hasattr\\(',
        'getattr\\(',
        'setattr\\(',
        'delattr\\(',
        'callable\\(',
        'isinstance\\(',
        'issubclass\\('',
        'iter\\(',
        'next\\(',
        'reload\\(',
        'importlib\\.',
        'imp\\.',
        'import \\*',
        'from \\* import'
      ],
      javascript: [
        'require\\([\'"]child_process[\'"]\\)',
        'require\\([\'"]fs[\'"]\\)',
        'require\\([\'"]os[\'"]\\)',
        'require\\([\'"]path[\'"]\\)',
        'require\\([\'"]net[\'"]\\)',
        'require\\([\'"]http[\'"]\\)',
        'require\\([\'"]https[\'"]\\)',
        'require\\([\'"]url[\'"]\\)',
        'require\\([\'"]dns[\'"]\\)',
        'require\\([\'"]cluster[\'"]\\)',
        'require\\([\'"]worker_threads[\'"]\\)',
        'eval\\(',
        'Function\\(',
        'setTimeout.*function',
        'setInterval.*function',
        'process\\.',
        'global\\.',
        'Buffer\\.',
        'console\\.',
        'document\\.',
        'window\\.',
        'localStorage',
        'sessionStorage',
        'XMLHttpRequest',
        'fetch\\(',
        'WebSocket',
        'Worker',
        'import\\s+\\*',
        'import.*from.*[\'"]child_process[\'"]',
        'import.*from.*[\'"]fs[\'"]'
      ],
      java: [
        'Runtime\\.getRuntime\\(\\)\\.exec',
        'ProcessBuilder',
        'System\\.exit',
        'System\\.gc',
        'Class\\.forName',
        'Reflection',
        'java\\.io\\.',
        'java\\.net\\.',
        'java\\.lang\\.reflect\\.',
        'java\\.security\\.',
        'java\\.rmi\\.',
        'javax\\.script\\.',
        'Process',
        'Thread\\.stop',
        'System\\.load',
        'System\\.loadLibrary'
      ],
      cpp: [
        'system\\(',
        'exec\\(',
        'popen\\(',
        'fork\\(',
        'kill\\(',
        'exit\\(',
        '_exit\\(',
        'abort\\(',
        'signal\\(',
        'raise\\(',
        'pthread_',
        'clone\\(',
        'vfork\\(',
        'wait\\(',
        'waitpid\\(',
        '#include\\s*<unistd\\.h>',
        '#include\\s*<sys\\/types\\.h>',
        '#include\\s*<sys\\/wait\\.h>',
        '#include\\s*<signal\\.h>',
        '#include\\s*<pthread\\.h>',
        'asm\\(',
        '__asm__',
        'volatile\\s+void\\s*\\*',
        'reinterpret_cast',
        'static_cast',
        'dynamic_cast',
        'const_cast'
      ]
    };

    return patterns[language] || [];
  }

  private containsSuspiciousCode(code: string, language: SupportedLanguage): boolean {
    // Check for extremely long code (possible DoS)
    if (code.length > 50000) {
      return true;
    }

    // Check for excessive recursion
    const recursionMatches = code.match(/function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\1\s*\(/gi);
    if (recursionMatches && recursionMatches.length > 10) {
      return true;
    }

    // Check for infinite loop patterns
    const infiniteLoopPatterns = [
      /while\s*\(\s*true\s*\)/gi,
      /for\s*\(\s*;;\s*\)/gi,
      /while\s*\(\s*1\s*\)/gi,
      /for\s*\(\s*;\s*1\s*;\s*\)/gi
    ];

    for (const pattern of infiniteLoopPatterns) {
      if (pattern.test(code)) {
        return true;
      }
    }

    // Check for memory bomb patterns
    const memoryBombPatterns = [
      /new\s+Array\s*\(\s*\d{6,}\s*\)/gi,
      /\[\s*\.\.\.\.Array\s*\(\s*\d{6,}\s*\)\.fill\(\)/gi,
      /Buffer\.alloc\s*\(\s*\d{6,}\s*\)/gi
    ];

    for (const pattern of memoryBombPatterns) {
      if (pattern.test(code)) {
        return true;
      }
    }

    return false;
  }

  private getLanguageId(language: SupportedLanguage): number {
    // Judge0 language IDs (may vary based on Judge0 configuration)
    const languageIds = {
      javascript: 63, // JavaScript (Node.js 18.15.0)
      python: 71, // Python (3.11.4)
      java: 62, // Java (OpenJDK 17.0.6)
      cpp: 54 // C++ (GCC 13.1.0)
    };

    return languageIds[language] || 71; // Default to Python
  }

  async getSubmissionStats(userId: string): Promise<{
    totalSubmissions: number;
    recentSubmissions: number;
    rateLimitRemaining: number;
    rateLimitResetTime: number;
  }> {
    const rateLimitKey = `${this.RATE_LIMIT_KEY}${userId}`;
    const current = await redisService.get(rateLimitKey);
    const ttl = await redisService.ttl(rateLimitKey);

    return {
      totalSubmissions: 0, // Would implement tracking in production
      recentSubmissions: current ? parseInt(current) : 0,
      rateLimitRemaining: Math.max(0, this.MAX_SUBMISSIONS_PER_MINUTE - (current ? parseInt(current) : 0)),
      rateLimitResetTime: ttl || 0
    };
  }

  async healthCheck(): Promise<{ status: string; judge0Url: string; responseTime: number }> {
    const startTime = Date.now();
    try {
      await axios.get(`${this.JUDGE0_URL}/about`, { timeout: 5000 });
      return {
        status: 'healthy',
        judge0Url: this.JUDGE0_URL,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        judge0Url: this.JUDGE0_URL,
        responseTime: Date.now() - startTime
      };
    }
  }
}

export const judgeService = new JudgeService();
