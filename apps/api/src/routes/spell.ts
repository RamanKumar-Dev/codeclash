import { Router } from 'express';
import { SpellService } from '@code-clash/backend/services';
import { redisService } from '@code-clash/backend/services';

const router = Router();
const spellService = new SpellService(redisService);

// Get all available spells
router.get('/spells', async (req, res) => {
  try {
    const spells = await spellService.getAllSpells();
    res.json(spells);
  } catch (error) {
    console.error('Error fetching spells:', error);
    res.status(500).json({ error: 'Failed to fetch spells' });
  }
});

// Get spell by ID
router.get('/spells/:spellId', async (req, res) => {
  try {
    const { spellId } = req.params;
    const spell = await spellService.getSpellById(spellId);
    
    if (!spell) {
      return res.status(404).json({ error: 'Spell not found' });
    }
    
    res.json(spell);
  } catch (error) {
    console.error('Error fetching spell:', error);
    res.status(500).json({ error: 'Failed to fetch spell' });
  }
});

// Get user's unlocked spells
router.get('/user/spells', async (req, res) => {
  try {
    // This would require authentication middleware to get userId
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get user data to check unlocked spells
    // const user = await getUserById(userId);
    // const unlockedSpells = await spellService.getUnlockedSpells(user.spellsUnlocked);
    
    res.json({ spells: [] }); // Placeholder
  } catch (error) {
    console.error('Error fetching user spells:', error);
    res.status(500).json({ error: 'Failed to fetch user spells' });
  }
});

// Initialize default spells (admin endpoint)
router.post('/admin/spells/initialize', async (req, res) => {
  try {
    await spellService.initializeDefaultSpells();
    res.json({ message: 'Default spells initialized successfully' });
  } catch (error) {
    console.error('Error initializing spells:', error);
    res.status(500).json({ error: 'Failed to initialize spells' });
  }
});

export default router;
