const axios = require('axios');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

class CodeJudgeEngine {
    constructor() {
        this.judge0BaseUrl = process.env.JUDGE0_API_URL || 'https://api.judge0.com';
        this.judge0ApiKey = process.env.JUDGE0_API_KEY;
        this.submissions = new Map();
        this.testCases = new Map();
        
        // Rate limiting configuration
        this.rateLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many submission attempts, please try again later.'
        });
        
        // Initialize test cases for different problems
        this.initializeTestCases();
    }

    initializeTestCases() {
        // Example test cases for a simple problem
        this.testCases.set('problem1', {
            visible: [
                {
                    input: '5\n3 8\n',
                    expectedOutput: '11\n',
                    description: 'Simple addition test case'
                }
            ],
            hidden: [
                {
                    input: '10\n20 30\n',
                    expectedOutput: '50\n',
                    description: 'Hidden test case 1'
                },
                {
                    input: '0\n-5 5\n',
                    expectedOutput: '0\n',
                    description: 'Hidden test case 2 - edge case'
                }
            ]
        });
    }

    async submitCode(submissionData) {
        const {
            playerId,
            opponentId,
            problemId,
            code,
            language,
            action = 'submit' // 'run_tests' or 'submit'
        } = submissionData;

        try {
            // Validate input
            this.validateSubmission(submissionData);
            
            // Create submission record
            const submissionId = this.generateSubmissionId();
            const submission = {
                id: submissionId,
                playerId,
                opponentId,
                problemId,
                code,
                language,
                action,
                status: 'pending',
                createdAt: new Date(),
                results: null
            };
            
            this.submissions.set(submissionId, submission);

            // Get test cases based on action
            const testCases = action === 'run_tests' 
                ? this.getVisibleTestCases(problemId)
                : this.getAllTestCases(problemId);

            // Execute code against test cases
            const results = await this.executeCode(code, language, testCases);
            
            // Calculate damage based on results
            const damage = this.calculateDamage(results, action);
            
            // Update submission with results
            submission.results = results;
            submission.status = 'completed';
            submission.damage = damage;
            submission.completedAt = new Date();

            return {
                submissionId,
                status: 'success',
                results,
                damage,
                action
            };

        } catch (error) {
            console.error('Submission error:', error);
            throw new Error(`Submission failed: ${error.message}`);
        }
    }

    validateSubmission(submissionData) {
        const { playerId, opponentId, problemId, code, language } = submissionData;
        
        if (!playerId || !opponentId || !problemId || !code || !language) {
            throw new Error('Missing required submission fields');
        }
        
        // Validate code length (prevent extremely long submissions)
        if (code.length > 10000) {
            throw new Error('Code exceeds maximum length limit');
        }
        
        // Validate language
        const supportedLanguages = ['python', 'javascript', 'java', 'cpp', 'c'];
        if (!supportedLanguages.includes(language.toLowerCase())) {
            throw new Error(`Unsupported language: ${language}`);
        }
        
        // Check for potentially malicious code patterns
        this.checkForMaliciousCode(code);
    }

    checkForMaliciousCode(code) {
        const maliciousPatterns = [
            /eval\s*\(/gi,
            /exec\s*\(/gi,
            /system\s*\(/gi,
            /__import__/gi,
            /subprocess\./gi,
            /os\./gi,
            /require\s*\(\s*['"]fs['"]\s*\)/gi,
            /import\s+fs/gi
        ];
        
        for (const pattern of maliciousPatterns) {
            if (pattern.test(code)) {
                throw new Error('Code contains potentially dangerous operations');
            }
        }
    }

    async executeCode(code, language, testCases) {
        const results = [];
        
        for (const testCase of testCases) {
            try {
                const result = await this.runSingleTest(code, language, testCase);
                results.push(result);
            } catch (error) {
                results.push({
                    testCase: testCase.description || 'Test case',
                    status: 'error',
                    error: error.message,
                    passed: false
                });
            }
        }
        
        return results;
    }

    async runSingleTest(code, language, testCase) {
        const languageMap = {
            'python': 71,
            'javascript': 63,
            'java': 62,
            'cpp': 54,
            'c': 50
        };
        
        const languageId = languageMap[language.toLowerCase()];
        if (!languageId) {
            throw new Error(`Unsupported language: ${language}`);
        }

        const submissionData = {
            source_code: code,
            language_id: languageId,
            stdin: testCase.input,
            expected_output: testCase.expectedOutput,
            max_time: 5, // 5 seconds timeout
            max_memory: 128000, // 128MB
            enable_network: false
        };

        const response = await axios.post(
            `${this.judge0BaseUrl}/submissions`,
            submissionData,
            {
                headers: {
                    'X-Auth-Token': this.judge0ApiKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const token = response.data.token;
        
        // Poll for results
        let result;
        let attempts = 0;
        const maxAttempts = 20;
        
        do {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const statusResponse = await axios.get(
                `${this.judge0BaseUrl}/submissions/${token}`,
                {
                    headers: {
                        'X-Auth-Token': this.judge0ApiKey
                    }
                }
            );
            
            result = statusResponse.data;
            attempts++;
            
        } while (result.status.id <= 2 && attempts < maxAttempts); // Processing status

        return {
            testCase: testCase.description || 'Test case',
            status: this.mapJudge0Status(result.status.description),
            passed: result.status.id === 3, // Accepted
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: result.stdout || '',
            executionTime: result.time,
            memoryUsage: result.memory,
            compileOutput: result.compile_output,
            runtimeError: result.stderr
        };
    }

    mapJudge0Status(judge0Status) {
        const statusMap = {
            'Accepted': 'passed',
            'Wrong Answer': 'wrong_answer',
            'Time Limit Exceeded': 'time_limit_exceeded',
            'Memory Limit Exceeded': 'memory_limit_exceeded',
            'Runtime Error': 'runtime_error',
            'Compile Error': 'compile_error'
        };
        
        return statusMap[judge0Status] || 'error';
    }

    calculateDamage(results, action) {
        if (action === 'run_tests') {
            return 0; // No damage for test runs
        }
        
        const totalTests = results.length;
        const passedTests = results.filter(r => r.passed).length;
        const passRate = totalTests > 0 ? passedTests / totalTests : 0;
        
        // Base damage calculation
        let baseDamage = 0;
        
        if (passRate === 1.0) {
            baseDamage = 100; // Perfect score
        } else if (passRate >= 0.8) {
            baseDamage = 80;
        } else if (passRate >= 0.6) {
            baseDamage = 60;
        } else if (passRate >= 0.4) {
            baseDamage = 40;
        } else if (passRate >= 0.2) {
            baseDamage = 20;
        } else {
            baseDamage = 10; // Minimum damage for attempting
        }
        
        // Bonus for speed (faster execution = more damage)
        const avgExecutionTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0) / totalTests;
        const speedBonus = Math.max(0, 20 - avgExecutionTime);
        
        // Bonus for memory efficiency
        const avgMemoryUsage = results.reduce((sum, r) => sum + (r.memoryUsage || 0), 0) / totalTests;
        const memoryBonus = Math.max(0, 10 - (avgMemoryUsage / 10000));
        
        return Math.round(baseDamage + speedBonus + memoryBonus);
    }

    getVisibleTestCases(problemId) {
        const problemTestCases = this.testCases.get(problemId);
        return problemTestCases ? problemTestCases.visible : [];
    }

    getAllTestCases(problemId) {
        const problemTestCases = this.testCases.get(problemId);
        if (!problemTestCases) return [];
        
        return [...problemTestCases.visible, ...problemTestCases.hidden];
    }

    generateSubmissionId() {
        return crypto.randomBytes(16).toString('hex');
    }

    getSubmission(submissionId) {
        return this.submissions.get(submissionId);
    }

    getPlayerSubmissions(playerId) {
        return Array.from(this.submissions.values())
            .filter(submission => submission.playerId === playerId);
    }

    // Health check method
    async healthCheck() {
        try {
            const response = await axios.get(`${this.judge0BaseUrl}/about`, {
                headers: {
                    'X-Auth-Token': this.judge0ApiKey
                }
            });
            return {
                status: 'healthy',
                judge0Status: response.data,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            };
        }
    }
}

module.exports = CodeJudgeEngine;
