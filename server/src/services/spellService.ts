import { RedisClientType } from 'redis';

export interface SpellEffect {
  type: 'hint' | 'time_freeze' | 'slow';
  casterId: string;
  targetId: string;
  roomId: string;
  expiresAt?: number; // timestamp ms
  hintIndex?: number;
}

export interface ManaState {
  current: number;
  max: number;
  lastRegenAt: number;
}

const SPELL_COSTS: Record<string, number> = {
  hint: 30,
  time_freeze: 50,
  slow: 40,
};

const SPELL_COOLDOWNS: Record<string, number> = {
  hint: 60000,      // 1 min
  time_freeze: 90000, // 1.5 min
  slow: 45000,      // 45s
};

const MANA_REGEN_RATE = 10;           // per minute
const MANA_REGEN_INTERVAL = 60000;    // every 60s
const MANA_MAX = 100;

export class SpellService {
  private redis: RedisClientType;

  constructor(redis: RedisClientType) {
    this.redis = redis;
  }

  /** Initialize mana for a player at battle start */
  async initMana(roomId: string, userId: string): Promise<void> {
    const mana: ManaState = {
      current: MANA_MAX,
      max: MANA_MAX,
      lastRegenAt: Date.now(),
    };
    await this.redis.setEx(`mana:${roomId}:${userId}`, 7200, JSON.stringify(mana));
  }

  /** Get current mana (with regen applied) */
  async getMana(roomId: string, userId: string): Promise<ManaState> {
    const raw = await this.redis.get(`mana:${roomId}:${userId}`);
    if (!raw) return { current: MANA_MAX, max: MANA_MAX, lastRegenAt: Date.now() };

    const mana: ManaState = JSON.parse(raw);
    const now = Date.now();
    const minutesPassed = (now - mana.lastRegenAt) / MANA_REGEN_INTERVAL;
    const regenAmount = Math.floor(minutesPassed * MANA_REGEN_RATE);

    if (regenAmount > 0) {
      mana.current = Math.min(mana.max, mana.current + regenAmount);
      mana.lastRegenAt = now;
      await this.redis.setEx(`mana:${roomId}:${userId}`, 7200, JSON.stringify(mana));
    }

    return mana;
  }

  /** Cast a spell — returns null on success, error message on failure */
  async castSpell(
    roomId: string,
    casterId: string,
    targetId: string,
    spellType: 'hint' | 'time_freeze' | 'slow',
    testCases?: Array<{ input: string; expectedOutput: string }>
  ): Promise<{ success: boolean; error?: string; effect?: SpellEffect; hintText?: string }> {
    const cost = SPELL_COSTS[spellType];
    const mana = await this.getMana(roomId, casterId);

    if (mana.current < cost) {
      return { success: false, error: `Not enough mana (need ${cost}, have ${mana.current})` };
    }

    // Check cooldown
    const cooldownKey = `spell_cd:${roomId}:${casterId}:${spellType}`;
    const onCooldown = await this.redis.get(cooldownKey);
    if (onCooldown) {
      return { success: false, error: `${spellType} is on cooldown` };
    }

    // Deduct mana
    mana.current -= cost;
    await this.redis.setEx(`mana:${roomId}:${casterId}`, 7200, JSON.stringify(mana));

    // Set cooldown
    const cooldownSec = Math.ceil(SPELL_COOLDOWNS[spellType] / 1000);
    await this.redis.setEx(cooldownKey, cooldownSec, '1');

    const effect: SpellEffect = {
      type: spellType,
      casterId,
      targetId,
      roomId,
    };

    let hintText: string | undefined;

    if (spellType === 'hint' && testCases && testCases.length > 0) {
      // Reveal a random non-trivial test case
      const idx = Math.floor(Math.random() * testCases.length);
      const tc = testCases[idx];
      hintText = `Hint: Input "${tc.input}" → Output "${tc.expectedOutput}"`;
      effect.hintIndex = idx;
    } else if (spellType === 'time_freeze') {
      effect.expiresAt = Date.now() + 15000; // 15s freeze
      await this.redis.setEx(
        `effect:freeze:${roomId}:${targetId}`,
        16,
        JSON.stringify(effect)
      );
    } else if (spellType === 'slow') {
      effect.expiresAt = Date.now() + 10000; // 10s slow
      await this.redis.setEx(
        `effect:slow:${roomId}:${targetId}`,
        11,
        JSON.stringify(effect)
      );
    }

    return { success: true, effect, hintText };
  }

  /** Check if a player is currently affected by a spell */
  async getActiveEffects(roomId: string, userId: string): Promise<{
    isFrozen: boolean;
    isSlowed: boolean;
  }> {
    const [frozenRaw, slowedRaw] = await Promise.all([
      this.redis.get(`effect:freeze:${roomId}:${userId}`),
      this.redis.get(`effect:slow:${roomId}:${userId}`),
    ]);
    return {
      isFrozen: !!frozenRaw,
      isSlowed: !!slowedRaw,
    };
  }

  /** Spell constants for use by the client */
  static getSpellInfo() {
    return {
      hint: { cost: SPELL_COSTS.hint, cooldownMs: SPELL_COOLDOWNS.hint, description: 'Reveal a test case to help you solve the puzzle' },
      time_freeze: { cost: SPELL_COSTS.time_freeze, cooldownMs: SPELL_COOLDOWNS.time_freeze, description: 'Freeze opponent\'s timer for 15 seconds' },
      slow: { cost: SPELL_COSTS.slow, cooldownMs: SPELL_COOLDOWNS.slow, description: 'Disable opponent\'s editor for 10 seconds' },
    };
  }
}
