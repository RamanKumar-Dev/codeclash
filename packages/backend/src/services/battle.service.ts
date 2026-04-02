export interface BattleState {
  id: string;
  player1: BattlePlayer;
  player2: BattlePlayer;
  currentPuzzle: string;
  status: 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'JUDGING' | 'ENDED';
  startTime?: Date;
  endTime?: Date;
  timeLimit: number; // seconds
  submissions: BattleSubmission[];
  spells: ActiveSpell[];
}

export interface BattlePlayer {
  userId: string;
  username: string;
  hp: number;
  maxHp: number;
  elo: number;
  currentCode: string;
  currentLanguage: string;
  isReady: boolean;
  spells: Spell[];
}

export interface BattleSubmission {
  playerId: string;
  code: string;
  language: string;
  timestamp: Date;
  result: SubmissionResult;
  damage: number;
  bonusDamage: number;
}

export interface SubmissionResult {
  passed: number;
  failed: number;
  total: number;
  runtimeMs: number;
  compileError?: string;
  runtimeError?: string;
}

export interface Spell {
  id: string;
  name: string;
  description: string;
  cooldown: number; // seconds
  lastUsed?: Date;
  effect: SpellEffect;
}

export interface SpellEffect {
  type: 'damage' | 'shield' | 'freeze' | 'hint' | 'double_damage' | 'debug' | 'wipe';
  value: number;
  duration?: number;
  target?: 'self' | 'opponent';
}

export interface ActiveSpell {
  id: string;
  casterId: string;
  targetId: string;
  spell: Spell;
  startTime: Date;
  endTime: Date;
}

export class BattleService {
  private static readonly STARTING_HP = 500;
  private static readonly MAX_DAMAGE_PER_SUBMISSION = 70;
  private static readonly BASE_DAMAGE = 20;

  static createBattle(
    player1: BattlePlayer,
    player2: BattlePlayer,
    puzzleId: string,
    timeLimit: number = 300 // 5 minutes default
  ): BattleState {
    return {
      id: this.generateBattleId(),
      player1: {
        ...player1,
        hp: this.STARTING_HP,
        maxHp: this.STARTING_HP,
        currentCode: '',
        currentLanguage: 'python',
        isReady: false,
      },
      player2: {
        ...player2,
        hp: this.STARTING_HP,
        maxHp: this.STARTING_HP,
        currentCode: '',
        currentLanguage: 'python',
        isReady: false,
      },
      currentPuzzle: puzzleId,
      status: 'WAITING',
      timeLimit,
      submissions: [],
      spells: [],
    };
  }

  static calculateDamage(submission: BattleSubmission, battleTime: number): number {
    const { result } = submission;
    
    if (result.failed === result.total) {
      return 0; // No damage for completely failed submissions
    }

    const passRatio = result.passed / result.total;
    
    // Base damage scaled by pass ratio
    let damage = this.BASE_DAMAGE * passRatio;
    
    // Speed bonus (faster submissions = more damage)
    const speedMultiplier = this.calculateSpeedMultiplier(battleTime);
    damage *= speedMultiplier;
    
    // Efficiency bonus (less runtime = more damage)
    const efficiencyBonus = this.calculateEfficiencyBonus(result.runtimeMs);
    damage += efficiencyBonus;
    
    // All-pass bonus
    if (result.passed === result.total) {
      damage += 10;
    }
    
    // First-solve bonus (check if this is the first correct submission)
    if (this.isFirstCorrectSubmission(submission)) {
      damage += 15;
    }
    
    // Apply damage cap
    return Math.min(damage, this.MAX_DAMAGE_PER_SUBMISSION);
  }

  private static calculateSpeedMultiplier(battleTime: number): number {
    // Battle time in seconds, max multiplier at 30 seconds
    if (battleTime <= 30) return 2.0;
    if (battleTime <= 60) return 1.5;
    if (battleTime <= 120) return 1.2;
    return 1.0;
  }

  private static calculateEfficiencyBonus(runtimeMs: number): number {
    // Runtime in milliseconds, bonus for fast execution
    if (runtimeMs <= 100) return 5;
    if (runtimeMs <= 500) return 3;
    if (runtimeMs <= 1000) return 1;
    return 0;
  }

  private static isFirstCorrectSubmission(submission: BattleSubmission): boolean {
    // This would need to check against previous submissions
    // For now, assume it's not the first
    return false;
  }

  static applyDamage(battle: BattleState, targetId: string, damage: number): BattleState {
    const targetPlayer = targetId === battle.player1.userId ? battle.player1 : battle.player2;
    
    // Check for active shields
    const activeShield = battle.spells.find(spell => 
      spell.targetId === targetId && 
      spell.spell.effect.type === 'shield' &&
      spell.endTime > new Date()
    );

    let actualDamage = damage;
    if (activeShield) {
      actualDamage = Math.max(0, damage - activeShield.spell.effect.value);
    }

    targetPlayer.hp = Math.max(0, targetPlayer.hp - actualDamage);
    
    return battle;
  }

  static castSpell(battle: BattleState, casterId: string, spellId: string): BattleState {
    const caster = casterId === battle.player1.userId ? battle.player1 : battle.player2;
    const spell = caster.spells.find(s => s.id === spellId);
    
    if (!spell) {
      throw new Error('Spell not found');
    }

    // Check cooldown
    if (spell.lastUsed && this.isSpellOnCooldown(spell)) {
      throw new Error('Spell is on cooldown');
    }

    const targetId = spell.effect.target === 'self' ? casterId : 
                    (casterId === battle.player1.userId ? battle.player2.userId : battle.player1.userId);

    const activeSpell: ActiveSpell = {
      id: this.generateSpellId(),
      casterId,
      targetId,
      spell,
      startTime: new Date(),
      endTime: new Date(Date.now() + (spell.effect.duration || 0) * 1000),
    };

    // Update spell cooldown
    spell.lastUsed = new Date();

    // Apply immediate effects
    this.applySpellEffect(battle, activeSpell);

    battle.spells.push(activeSpell);
    
    return battle;
  }

  private static applySpellEffect(battle: BattleState, activeSpell: ActiveSpell): void {
    const { spell, targetId } = activeSpell;
    const target = targetId === battle.player1.userId ? battle.player1 : battle.player2;

    switch (spell.effect.type) {
      case 'damage':
        this.applyDamage(battle, targetId, spell.effect.value);
        break;
      case 'shield':
        // Shield is handled in applyDamage method
        break;
      case 'freeze':
        // Freeze would pause the timer - handled by battle timer logic
        break;
      case 'hint':
        // Reveal a hint - handled by UI
        break;
      case 'double_damage':
        // Next submission deals double damage - handled in calculateDamage
        break;
      case 'debug':
        // Fake compile error - handled by submission logic
        break;
      case 'wipe':
        // Clear opponent's output panel - handled by UI
        break;
    }
  }

  private static isSpellOnCooldown(spell: Spell): boolean {
    if (!spell.lastUsed) return false;
    const cooldownEnd = new Date(spell.lastUsed.getTime() + spell.cooldown * 1000);
    return new Date() < cooldownEnd;
  }

  static isBattleOver(battle: BattleState): boolean {
    return battle.player1.hp <= 0 || battle.player2.hp <= 0;
  }

  static getWinner(battle: BattleState): string | null {
    if (battle.player1.hp <= 0) return battle.player2.userId;
    if (battle.player2.hp <= 0) return battle.player1.userId;
    return null;
  }

  static updateBattleStatus(battle: BattleState, status: BattleState['status']): BattleState {
    battle.status = status;
    
    if (status === 'ACTIVE') {
      battle.startTime = new Date();
    } else if (status === 'ENDED') {
      battle.endTime = new Date();
    }
    
    return battle;
  }

  static cleanupExpiredSpells(battle: BattleState): BattleState {
    const now = new Date();
    battle.spells = battle.spells.filter(spell => spell.endTime > now);
    return battle;
  }

  private static generateBattleId(): string {
    return `battle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private static generateSpellId(): string {
    return `spell_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  static getAvailableSpells(): Spell[] {
    return [
      {
        id: 'oracle_hint',
        name: 'Oracle Hint',
        description: 'Reveal a hidden test case',
        cooldown: 60,
        effect: {
          type: 'hint',
          value: 1,
          target: 'self',
        },
      },
      {
        id: 'time_freeze',
        name: 'Time Freeze',
        description: 'Pause the battle timer for 15 seconds',
        cooldown: 90,
        effect: {
          type: 'freeze',
          value: 15,
          duration: 15,
          target: 'self',
        },
      },
      {
        id: 'tower_shield',
        name: 'Tower Shield',
        description: 'Block up to 50 HP damage',
        cooldown: 120,
        effect: {
          type: 'shield',
          value: 50,
          target: 'self',
        },
      },
      {
        id: 'double_damage',
        name: 'Double Damage',
        description: 'Your next submission deals 2x damage',
        cooldown: 150,
        effect: {
          type: 'double_damage',
          value: 2,
          target: 'self',
        },
      },
      {
        id: 'debug_ray',
        name: 'Debug Ray',
        description: 'Cause a fake compile error on opponent',
        cooldown: 180,
        effect: {
          type: 'debug',
          value: 1,
          target: 'opponent',
        },
      },
      {
        id: 'code_wipe',
        name: 'Code Wipe',
        description: 'Clear opponent\'s output panel',
        cooldown: 60,
        effect: {
          type: 'wipe',
          value: 1,
          target: 'opponent',
        },
      },
    ];
  }
}
