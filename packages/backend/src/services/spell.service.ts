import { RedisService } from './redis.service';
import { SpellModel } from '../models/spell.model';
import { 
  Spell, 
  SpellCastRequest, 
  SpellCastResult, 
  SpellUnlockNotification, 
  ActiveSpellEffect,
  REDIS_KEYS,
  User,
  SpellEffect
} from '@code-clash/shared-types';

export class SpellService {
  constructor(private redisService: RedisService) {}

  async getAllSpells(): Promise<Spell[]> {
    const spells = await SpellModel.find({}).lean();
    return spells.map(spell => ({
      spellId: spell.spellId,
      name: spell.name,
      icon: spell.icon,
      description: spell.description,
      cooldownSeconds: spell.cooldownSeconds,
      unlockCondition: spell.unlockCondition,
      effect: spell.effect
    }));
  }

  async getSpellById(spellId: string): Promise<Spell | null> {
    const spell = await SpellModel.findOne({ spellId }).lean();
    if (!spell) return null;
    
    return {
      spellId: spell.spellId,
      name: spell.name,
      icon: spell.icon,
      description: spell.description,
      cooldownSeconds: spell.cooldownSeconds,
      unlockCondition: spell.unlockCondition,
      effect: spell.effect
    };
  }

  async castSpell(request: SpellCastRequest, casterId: string): Promise<SpellCastResult> {
    const { spellId, roomId, targetUserId } = request;

    // Get spell definition
    const spell = await this.getSpellById(spellId);
    if (!spell) {
      return {
        success: false,
        spellId,
        casterId,
        effect: spell.effect,
        cooldownUntil: new Date(),
        error: 'Spell not found'
      };
    }

    // Check cooldown
    const cooldownKey = `${REDIS_KEYS.SPELL_COOLDOWN}${roomId}:${casterId}:${spellId}`;
    const cooldownTTL = await this.redisService.ttl(cooldownKey);
    
    if (cooldownTTL > 0) {
      return {
        success: false,
        spellId,
        casterId,
        effect: spell.effect,
        cooldownUntil: new Date(Date.now() + cooldownTTL * 1000),
        error: 'Spell is on cooldown'
      };
    }

    // Apply spell effect
    const effectApplied = await this.applySpellEffect(spell, roomId, casterId, targetUserId);
    if (!effectApplied.success) {
      return {
        success: false,
        spellId,
        casterId,
        effect: spell.effect,
        cooldownUntil: new Date(),
        error: effectApplied.error
      };
    }

    // Set cooldown
    const cooldownUntil = new Date(Date.now() + spell.cooldownSeconds * 1000);
    await this.redisService.setex(cooldownKey, spell.cooldownSeconds, '1');

    return {
      success: true,
      spellId,
      casterId,
      effect: spell.effect,
      cooldownUntil
    };
  }

  private async applySpellEffect(
    spell: Spell, 
    roomId: string, 
    casterId: string, 
    targetUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const targetId = targetUserId || casterId;
    const activeSpellKey = `${REDIS_KEYS.ACTIVE_SPELLS}${roomId}:${targetId}`;

    try {
      switch (spell.effect.type) {
        case 'oracle_hint':
          // Reveal one hidden test case - handled by battle service
          await this.addActiveSpell(activeSpellKey, spell.spellId, casterId, targetId, spell.effect);
          break;

        case 'time_freeze':
          // Pause battle timer for 15 seconds - handled by battle service
          await this.addActiveSpell(activeSpellKey, spell.spellId, casterId, targetId, {
            ...spell.effect,
            duration: 15,
            expiresAt: new Date(Date.now() + 15000)
          });
          break;

        case 'tower_shield':
          // Negate next 50 HP of damage - handled by battle service
          await this.addActiveSpell(activeSpellKey, spell.spellId, casterId, targetId, {
            ...spell.effect,
            value: 50
          });
          break;

        case 'debug_ray':
          // Force compile error on next submission - handled by battle service
          await this.addActiveSpell(activeSpellKey, spell.spellId, casterId, targetId, spell.effect);
          break;

        case 'double_damage':
          // Next submission deals 2x damage - handled by battle service
          await this.addActiveSpell(activeSpellKey, spell.spellId, casterId, targetId, {
            ...spell.effect,
            value: 2
          });
          break;

        case 'code_wipe':
          // Clear opponent's output panel - handled by battle service
          await this.addActiveSpell(activeSpellKey, spell.spellId, casterId, targetId, spell.effect);
          break;

        default:
          return { success: false, error: 'Unknown spell effect type' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error applying spell effect:', error);
      return { success: false, error: 'Failed to apply spell effect' };
    }
  }

  private async addActiveSpell(
    key: string,
    spellId: string,
    casterId: string,
    targetId: string,
    effect: SpellEffect & { expiresAt?: Date }
  ): Promise<void> {
    const activeSpell: ActiveSpellEffect = {
      spellId,
      casterId,
      targetId: targetId !== casterId ? targetId : undefined,
      effect: {
        type: effect.type,
        duration: effect.duration,
        value: effect.value
      },
      expiresAt: effect.expiresAt || new Date(Date.now() + (effect.duration || 0) * 1000),
      isActive: true
    };

    await this.redisService.lpush(key, JSON.stringify(activeSpell));
    
    // Set TTL if duration is specified
    if (effect.duration && effect.duration > 0) {
      await this.redisService.expire(key, effect.duration);
    }
  }

  async getActiveSpells(roomId: string, userId: string): Promise<ActiveSpellEffect[]> {
    const key = `${REDIS_KEYS.ACTIVE_SPELLS}${roomId}:${userId}`;
    const activeSpells = await this.redisService.lrange(key, 0, -1);
    
    return activeSpells
      .map(spell => JSON.parse(spell) as ActiveSpellEffect)
      .filter(spell => spell.isActive && new Date(spell.expiresAt) > new Date());
  }

  async removeActiveSpell(roomId: string, userId: string, spellId: string): Promise<void> {
    const key = `${REDIS_KEYS.ACTIVE_SPELLS}${roomId}:${userId}`;
    const activeSpells = await this.redisService.lrange(key, 0, -1);
    
    for (let i = 0; i < activeSpells.length; i++) {
      const spell = JSON.parse(activeSpells[i]) as ActiveSpellEffect;
      if (spell.spellId === spellId) {
        await this.redisService.lrem(key, 1, activeSpells[i]);
        break;
      }
    }
  }

  async checkUnlocks(user: User): Promise<SpellUnlockNotification[]> {
    const allSpells = await this.getAllSpells();
    const unlockedSpells: SpellUnlockNotification[] = [];

    for (const spell of allSpells) {
      // Skip if already unlocked
      if (user.spellsUnlocked.includes(spell.spellId)) {
        continue;
      }

      // Check unlock conditions
      let shouldUnlock = false;

      switch (spell.unlockCondition.type) {
        case 'battles_won':
          shouldUnlock = user.battlesWon >= spell.unlockCondition.value;
          break;
        case 'elo_reached':
          shouldUnlock = user.elo >= spell.unlockCondition.value;
          break;
      }

      if (shouldUnlock) {
        unlockedSpells.push({
          spellId: spell.spellId,
          spell,
          userId: user.id
        });
      }
    }

    return unlockedSpells;
  }

  async initializeDefaultSpells(): Promise<void> {
    const defaultSpells: Omit<Spell, 'spellId'>[] = [
      {
        name: 'Oracle Hint',
        icon: '🔮',
        description: 'Reveal one hidden test case input/output',
        cooldownSeconds: 999999, // Once per battle
        unlockCondition: { type: 'battles_won', value: 5 },
        effect: { type: 'oracle_hint' }
      },
      {
        name: 'Time Freeze',
        icon: '⏩',
        description: 'Pause the battle timer for 15 seconds',
        cooldownSeconds: 180, // 3 minutes
        unlockCondition: { type: 'elo_reached', value: 1200 },
        effect: { type: 'time_freeze', duration: 15 }
      },
      {
        name: 'Tower Shield',
        icon: '🛡',
        description: 'Negate next 50 HP of damage received',
        cooldownSeconds: 120, // 2 minutes
        unlockCondition: { type: 'battles_won', value: 10 },
        effect: { type: 'tower_shield', value: 50 }
      },
      {
        name: 'Debug Ray',
        icon: '⚡',
        description: 'Force opponent\'s next submission to show a compile error',
        cooldownSeconds: 240, // 4 minutes
        unlockCondition: { type: 'elo_reached', value: 1400 },
        effect: { type: 'debug_ray' }
      },
      {
        name: 'Double Damage',
        icon: '🔥',
        description: 'Next submission deals 2x damage',
        cooldownSeconds: 300, // 5 minutes
        unlockCondition: { type: 'battles_won', value: 25 },
        effect: { type: 'double_damage', value: 2 }
      },
      {
        name: 'Code Wipe',
        icon: '🌀',
        description: 'Clear opponent\'s output panel',
        cooldownSeconds: 180, // 3 minutes
        unlockCondition: { type: 'elo_reached', value: 1600 },
        effect: { type: 'code_wipe' }
      }
    ];

    for (const spellData of defaultSpells) {
      const spellId = spellData.name.toLowerCase().replace(/\s+/g, '_');
      
      const existing = await SpellModel.findOne({ spellId });
      if (!existing) {
        await SpellModel.create({
          spellId,
          ...spellData
        });
      }
    }
  }
}
