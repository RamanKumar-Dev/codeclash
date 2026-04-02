import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { judgeService } from '../services/judge.service';
import { redisService } from '../services/redis.service';
import { SupportedLanguage } from '@code-clash/shared-types';

const router = Router();

// All battle routes require auth
router.use(authMiddleware.authenticate);

// POST /api/battle/execute  — run code against visible test cases (no HP damage)
router.post('/execute', async (req: any, res: Response) => {
  try {
    const { code, language, roomId } = req.body;

    if (!code || !language || !roomId) {
      return res.status(400).json({ error: 'code, language and roomId are required' });
    }

    const battleState = await redisService.getBattleState(roomId);
    if (!battleState) {
      return res.status(404).json({ error: 'Battle room not found' });
    }

    const puzzle = battleState.puzzle;
    const visibleTests = puzzle.testCases.filter((tc: any) => !tc.isHidden);

    const results = await Promise.all(
      visibleTests.slice(0, 5).map(async (tc: any) => {
        try {
          const submission = await judgeService.submitCode(
            req.user.id,
            code,
            language as SupportedLanguage,
            tc.input,
            tc.expected
          );
          const result = await judgeService.waitForResult(submission.token);
          const passed =
            result.status?.id === 3 &&
            (result.runtime_stdout || '').trim() === tc.expected.trim();
          return {
            input: tc.input,
            expected: tc.expected,
            output: result.runtime_stdout || '',
            passed,
            runtime_ms: result.runtime_time ? Math.round(result.runtime_time * 1000) : null,
            error: result.runtime_stderr || result.compile_output || null,
          };
        } catch {
          return { input: tc.input, expected: tc.expected, output: '', passed: false, error: 'Execution error' };
        }
      })
    );

    return res.json({ testResults: results });
  } catch (err) {
    console.error('Execute error:', err);
    return res.status(500).json({ error: 'Code execution failed' });
  }
});

// GET /api/battle/room/:roomId — fetch current battle state
router.get('/room/:roomId', async (req: any, res: Response) => {
  try {
    const { roomId } = req.params;
    const battleState = await redisService.getBattleState(roomId);

    if (!battleState) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Strip hidden test cases before sending to client
    const safeState = {
      ...battleState,
      puzzle: {
        ...battleState.puzzle,
        testCases: battleState.puzzle.testCases.filter((tc: any) => !tc.isHidden),
      },
    };

    return res.json(safeState);
  } catch (err) {
    console.error('Get room error:', err);
    return res.status(500).json({ error: 'Failed to fetch battle state' });
  }
});

export default router;
