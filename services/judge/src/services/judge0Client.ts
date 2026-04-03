import axios, { AxiosInstance } from 'axios';
import { Judge0Submission, Judge0Result, TestCase, TestCaseResult, ExecutionResult } from '../types';
import { JUDGE0_CONFIG, getLanguageId, getExecutionLimits, isSuccessfulExecution, JUDGE0_STATUS_CODES } from '../config/constants';

export class Judge0Client {
  private client: AxiosInstance;
  private baseUrl: string;
  private isHealthy: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.baseUrl = JUDGE0_CONFIG.API_URL;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: JUDGE0_CONFIG.TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Start periodic health checks
    this.startHealthChecks();
  }

  async submitCode(
    sourceCode: string,
    language: string,
    stdin?: string,
    expectedOutput?: string
  ): Promise<Judge0Result> {
    // Check Judge0 health before submission
    if (!await this.checkHealth()) {
      throw new Error('Judge0 service is currently unavailable. Please try again.');
    }

    const languageId = getLanguageId(language);
    const limits = getExecutionLimits(language);

    const submission: Judge0Submission = {
      source_code: sourceCode,
      language_id: languageId,
      stdin,
      expected_output: expectedOutput,
      cpu_time_limit: limits.CPU_TIME_LIMIT,
      memory_limit: limits.MEMORY_LIMIT,
      max_cpu_time: limits.CPU_TIME_LIMIT + 1,
      max_memory: limits.MEMORY_LIMIT + 64,
      wall_time_limit: limits.WALL_TIME_LIMIT,
    };

    try {
      console.log(`Submitting code to Judge0: language=${language}, language_id=${languageId}`);
      
      const response = await this.client.post('/submissions', submission);
      const token = response.data.token;

      // Poll for result with timeout wrapper
      return await this.pollForResultWithTimeout(token);
    } catch (error) {
      console.error('Error submitting code to Judge0:', error);
      
      // Mark as unhealthy on error
      this.isHealthy = false;
      
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw new Error('Judge0 service timed out. Please try again.');
      }
      
      throw new Error('Failed to submit code to Judge0. Please try again.');
    }
  }

  async submitBatch(
    sourceCode: string,
    language: string,
    testCases: TestCase[]
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    for (const testCase of testCases) {
      try {
        const judge0Result = await this.submitCode(
          sourceCode,
          language,
          testCase.input,
          testCase.expectedOutput
        );

        const testCaseResult: TestCaseResult = {
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: judge0Result.stdout?.trim() || '',
          passed: this.isTestCasePassed(judge0Result),
          runtime_ms: parseFloat(judge0Result.time || '0') * 1000, // Convert to ms
          memory_kb: judge0Result.memory || 0,
          statusCode: judge0Result.status.id,
          statusDescription: judge0Result.status.description,
        };

        results.push(testCaseResult);
      } catch (error) {
        console.error(`Error executing test case: ${testCase.description || 'unnamed'}`, error);
        
        // Add a failed result for this test case
        results.push({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: '',
          passed: false,
          runtime_ms: 0,
          memory_kb: 0,
          statusCode: JUDGE0_STATUS_CODES.INTERNAL_ERROR,
          statusDescription: 'Internal Error',
        });
      }
    }

    return results;
  }

  private async pollForResultWithTimeout(token: string): Promise<Judge0Result> {
    let attempts = 0;
    const maxAttempts = JUDGE0_CONFIG.MAX_POLL_ATTEMPTS;
    const startTime = Date.now();

    while (attempts < maxAttempts) {
      // Check if we've exceeded the overall timeout
      if (Date.now() - startTime > JUDGE0_CONFIG.TIMEOUT_MS) {
        throw new Error('Judge0 submission timeout. Please try again.');
      }

      try {
        const response = await this.client.get(`/submissions/${token}`);
        const result = response.data;

        // Check if submission is finished
        if (result.status.id >= JUDGE0_STATUS_CODES.SUCCESS) {
          return result;
        }

        // Still processing, wait and poll again
        await this.delay(JUDGE0_CONFIG.POLL_INTERVAL_MS);
        attempts++;
      } catch (error) {
        console.error(`Error polling for result (attempt ${attempts + 1}):`, error);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw new Error('Failed to get result from Judge0 after maximum attempts');
        }
        
        await this.delay(JUDGE0_CONFIG.POLL_INTERVAL_MS);
      }
    }

    throw new Error(`Judge0 submission timeout after ${maxAttempts} attempts`);
  }

  private isTestCasePassed(result: Judge0Result): boolean {
    // Check if execution was successful and output matches expected
    if (!isSuccessfulExecution(result.status.id)) {
      return false;
    }

    const actualOutput = (result.stdout || '').trim();
    const expectedOutput = (result.expected_output || '').trim();

    return actualOutput === expectedOutput;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getSupportedLanguages(): Promise<any[]> {
    try {
      const response = await this.client.get('/languages');
      return response.data;
    } catch (error) {
      console.error('Error fetching supported languages:', error);
      throw new Error('Failed to fetch supported languages from Judge0');
    }
  }

  async getSystemInfo(): Promise<any> {
    try {
      const response = await this.client.get('/system');
      return response.data;
    } catch (error) {
      console.error('Error fetching system info:', error);
      throw new Error('Failed to fetch system info from Judge0');
    }
  }

  async healthCheck(): Promise<boolean> {
    return await this.checkHealth();
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/system', {
        timeout: 3000 // 3 second timeout for health check
      });
      
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      return true;
    } catch (error) {
      console.error('[Judge0] Health check failed:', error);
      this.isHealthy = false;
      return false;
    }
  }

  private startHealthChecks(): void {
    // Check health immediately
    this.checkHealth();
    
    // Then check periodically
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, JUDGE0_CONFIG.HEALTH_CHECK_INTERVAL);
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  getHealthStatus(): { isHealthy: boolean; lastCheck: number } {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastHealthCheck
    };
  }
}
