import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.middleware';
import { User } from '../models/user.model';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }

    // Check for existing user
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ error: 'Email or username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    const user = new User({
      id: userId,
      username,
      email,
      passwordHash,
      elo: 1200,
    });

    await user.save();

    const token = authMiddleware.generateToken(userId, username, email);

    return res.status(201).json({
      token,
      user: { id: userId, username, email, elo: 1200 },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = authMiddleware.generateToken(user.id, user.username, user.email);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        elo: user.elo,
        totalWins: user.totalWins,
        totalLosses: user.totalLosses,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me — returns current user (requires token)
router.get('/me', authMiddleware.authenticate, async (req: any, res: Response) => {
  try {
    const user = await User.findOne({ id: req.user.id }).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware.authenticate, async (req: any, res: Response) => {
  try {
    const token = req.headers.authorization?.substring(7);
    if (token) {
      await authMiddleware.revokeToken(token);
    }
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;
