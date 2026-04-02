import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { User } from '../models/user.model';

const router = Router();

const ALL_SPELLS = [
  {
    id: 'oracle_hint',
    name: 'Oracle Hint',
    icon: '🔮',
    description: 'Reveals one hidden test case',
    manaCost: 30,
    cooldownSeconds: 60,
    unlockCondition: { wins: 0 },
  },
  {
    id: 'time_freeze',
    name: 'Time Freeze',
    icon: '❄️',
    description: 'Pauses the battle timer for 15 seconds',
    manaCost: 20,
    cooldownSeconds: 120,
    unlockCondition: { wins: 5 },
  },
  {
    id: 'tower_shield',
    name: 'Tower Shield',
    icon: '🛡️',
    description: 'Negates up to 50 HP of incoming damage',
    manaCost: 40,
    cooldownSeconds: 180,
    unlockCondition: { wins: 10 },
  },
  {
    id: 'double_damage',
    name: 'Double Damage',
    icon: '⚡',
    description: 'Next submission deals 2× damage',
    manaCost: 60,
    cooldownSeconds: 300,
    unlockCondition: { wins: 20 },
  },
  {
    id: 'debug_ray',
    name: 'Debug Ray',
    icon: '🐛',
    description: 'Causes a fake compile error on opponent\'s next attempt',
    manaCost: 50,
    cooldownSeconds: 240,
    unlockCondition: { wins: 15 },
  },
  {
    id: 'code_wipe',
    name: 'Code Wipe',
    icon: '🌊',
    description: 'Clears opponent\'s output panel',
    manaCost: 70,
    cooldownSeconds: 360,
    unlockCondition: { wins: 30 },
  },
];

// GET /api/spells — returns all spells with unlock status for current user
router.get('/', authMiddleware.authenticate, async (req: any, res: Response) => {
  try {
    const user = await User.findOne({ id: req.user.id }).select('totalWins elo');
    const wins = user?.totalWins ?? 0;

    const spells = ALL_SPELLS.map((spell) => ({
      ...spell,
      isUnlocked: wins >= spell.unlockCondition.wins,
    }));

    return res.json({ spells });
  } catch (err) {
    console.error('Get spells error:', err);
    return res.status(500).json({ error: 'Failed to fetch spells' });
  }
});

export default router;
