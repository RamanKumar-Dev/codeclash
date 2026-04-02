import express, { Request, Response } from 'express';
import Joi from 'joi';
import { ExecutionService } from '../services/executionService';
import { ExecutionRequest } from '../types';

const executionRequestSchema = Joi.object({
  code: Joi.string().required().max(100000), // 100KB max code size
  language: Joi.string().required().valid('python', 'javascript', 'cpp', 'java', 'go', 'py', 'js', 'c++', 'ts'),
  puzzleId: Joi.string().required(),
  userId: Joi.string().required(),
  roomId: Joi.string().required(),
  submissionId: Joi.string().optional(),
});

export function createExecutionRoutes(executionService: ExecutionService): express.Router {
  const router = express.Router();

  // Main execution endpoint
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      // Validate request
      const { error, value } = executionRequestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
      }

      const executionRequest: ExecutionRequest = value;

      // Execute code and calculate damage
      const result = await executionService.executeCode(executionRequest);

      // Return battle damage result
      res.json({
        success: true,
        data: {
          damage: result.damage,
          opponentHp: result.opponentHp,
          isBattleOver: result.isBattleOver,
          winner: result.winner,
          executionResult: {
            passed: result.executionResult.passed,
            total: result.executionResult.total,
            runtime_ms: result.executionResult.runtime_ms,
            memory_kb: result.executionResult.memory_kb,
            statusCode: result.executionResult.statusCode,
            statusDescription: result.executionResult.statusDescription,
            correctnessRatio: result.executionResult.correctnessRatio,
          },
          damageBreakdown: result.damageBreakdown,
        }
      });

    } catch (error) {
      console.error('Error in /execute endpoint:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = errorMessage.includes('not found') ? 404 : 
                        errorMessage.includes('Unsupported language') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        error: errorMessage
      });
    }
  });

  // Get execution history for a user
  router.get('/history/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      if (limit > 100) {
        return res.status(400).json({
          error: 'Limit cannot exceed 100'
        });
      }

      const history = await executionService.getExecutionHistory(userId, limit);

      res.json({
        success: true,
        data: history.map(submission => ({
          id: submission.id,
          problemTitle: submission.problem.title,
          difficulty: submission.problem.difficulty,
          language: submission.language,
          passedTests: submission.passedTests,
          totalTests: submission.totalTests,
          runtimeMs: submission.execTimeMs,
          damageDealt: submission.damageDealt,
          createdAt: submission.createdAt,
        }))
      });

    } catch (error) {
      console.error('Error getting execution history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get execution history'
      });
    }
  });

  // Health check endpoint
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await executionService.healthCheck();
      
      const isHealthy = Object.values(health).every(status => status === true);
      const statusCode = isHealthy ? 200 : 503;

      res.status(statusCode).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        services: health,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error in health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Get supported languages
  router.get('/languages', async (req: Request, res: Response) => {
    try {
      // Return our supported languages mapping
      const languages = [
        { id: 71, name: 'Python', extension: '.py', aliases: ['python', 'py'] },
        { id: 63, name: 'JavaScript', extension: '.js', aliases: ['javascript', 'js', 'ts'] },
        { id: 54, name: 'C++', extension: '.cpp', aliases: ['cpp', 'c++'] },
        { id: 62, name: 'Java', extension: '.java', aliases: ['java'] },
        { id: 60, name: 'Go', extension: '.go', aliases: ['go'] },
      ];

      res.json({
        success: true,
        data: languages
      });

    } catch (error) {
      console.error('Error getting languages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get supported languages'
      });
    }
  });

  // Validate code without executing (syntax check)
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const { error, value } = executionRequestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.details.map(d => d.message)
        });
      }

      const { code, language } = value;

      // Basic syntax validation based on language
      const validationError = await validateSyntax(code, language);
      
      if (validationError) {
        return res.json({
          success: false,
          valid: false,
          error: validationError
        });
      }

      res.json({
        success: true,
        valid: true,
        message: 'Code syntax appears valid'
      });

    } catch (error) {
      console.error('Error validating code:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate code'
      });
    }
  });

  return router;
}

// Basic syntax validation helper
async function validateSyntax(code: string, language: string): Promise<string | null> {
  // This is a very basic syntax validation
  // In production, you might want to use language-specific parsers or linters
  
  const trimmedCode = code.trim();
  
  if (!trimmedCode) {
    return 'Code cannot be empty';
  }

  // Basic checks for common syntax issues
  switch (language.toLowerCase()) {
    case 'python':
    case 'py':
      // Check for basic Python syntax issues
      if (trimmedCode.includes('def ') && !trimmedCode.includes(':')) {
        return 'Function definition missing colon';
      }
      if (trimmedCode.includes('if ') && !trimmedCode.includes(':')) {
        return 'If statement missing colon';
      }
      if (trimmedCode.includes('for ') && !trimmedCode.includes(':')) {
        return 'For loop missing colon';
      }
      break;

    case 'javascript':
    case 'js':
    case 'ts':
      // Check for basic JavaScript syntax issues
      const openBraces = (trimmedCode.match(/{/g) || []).length;
      const closeBraces = (trimmedCode.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        return 'Unmatched braces';
      }
      const openParens = (trimmedCode.match(/\(/g) || []).length;
      const closeParens = (trimmedCode.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        return 'Unmatched parentheses';
      }
      break;

    case 'cpp':
    case 'c++':
      // Check for basic C++ syntax issues
      if (trimmedCode.includes('#include') && !trimmedCode.includes('using namespace') && !trimmedCode.includes('std::')) {
        return 'Missing namespace declaration or std:: prefix';
      }
      if (trimmedCode.includes('main') && !trimmedCode.includes('return')) {
        return 'Main function should return a value';
      }
      break;

    case 'java':
      // Check for basic Java syntax issues
      if (!trimmedCode.includes('class ')) {
        return 'Java code must contain a class';
      }
      if (trimmedCode.includes('public static void main') && !trimmedCode.includes('String[] args')) {
        return 'Main method signature should include String[] args';
      }
      break;

    case 'go':
      // Check for basic Go syntax issues
      if (!trimmedCode.includes('package ')) {
        return 'Go code must start with package declaration';
      }
      break;
  }

  return null; // No syntax errors detected
}
