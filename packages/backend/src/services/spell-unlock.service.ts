import { SpellService } from './spell.service';
import { userService } from './user.service';
import { redisService } from './redis.service';
import { User, SpellUnlockNotification } from '@code-clash/shared-types';

export class SpellUnlockService {
  private spellService: SpellService;

  constructor() {
    this.spellService = new SpellService(redisService);
  }

  async checkAndAwardSpells(winnerId: string, loserId: string): Promise<SpellUnlockNotification[]> {
    const unlockNotifications: SpellUnlockNotification[] = [];

    try {
      // Get updated user stats for both players
      const winner = await userService.getUserById(winnerId);
      const loser = await userService.getUserById(loserId);

      if (!winner || !loser) {
        console.error('Failed to fetch user data for spell unlock check');
        return [];
      }

      // Check for new spell unlocks for winner
      const winnerUnlocks = await this.spellService.checkUnlocks(winner);
      unlockNotifications.push(...winnerUnlocks);

      // Check for new spell unlocks for loser
      const loserUnlocks = await this.spellService.checkUnlocks(loser);
      unlockNotifications.push(...loserUnlocks);

      // Update user records with new unlocked spells
      if (winnerUnlocks.length > 0) {
        await this.updateUserSpells(winner, winnerUnlocks);
      }

      if (loserUnlocks.length > 0) {
        await this.updateUserSpells(loser, loserUnlocks);
      }

      return unlockNotifications;
    } catch (error) {
      console.error('Error checking spell unlocks:', error);
      return [];
    }
  }

  private async updateUserSpells(user: User, unlocks: SpellUnlockNotification[]): Promise<void> {
    const newSpellIds = unlocks.map(unlock => unlock.spellId);
    const updatedSpellsUnlocked = [...new Set([...user.spellsUnlocked, ...newSpellIds])];

    await userService.updateUser(user.id, {
      spellsUnlocked: updatedSpellsUnlocked
    });

    console.log(`User ${user.username} unlocked ${newSpellIds.join(', ')}`);
  }

  async getUnlockedSpellsForUser(userId: string): Promise<any[]> {
    try {
      const user = await userService.getUserById(userId);
      if (!user) {
        return [];
      }

      const allSpells = await this.spellService.getAllSpells();
      
      return allSpells.map(spell => ({
        ...spell,
        isUnlocked: user.spellsUnlocked.includes(spell.spellId),
        unlockProgress: this.calculateUnlockProgress(user, spell)
      }));
    } catch (error) {
      console.error('Error fetching unlocked spells:', error);
      return [];
    }
  }

  private calculateUnlockProgress(user: User, spell: any): { current: number; required: number; type: string } {
    const { unlockCondition } = spell;
    
    switch (unlockCondition.type) {
      case 'battles_won':
        return {
          current: user.battlesWon,
          required: unlockCondition.value,
          type: 'battles_won'
        };
      case 'elo_reached':
        return {
          current: user.elo,
          required: unlockCondition.value,
          type: 'elo_reached'
        };
      default:
        return {
          current: 0,
          required: unlockCondition.value,
          type: unlockCondition.type
        };
    }
  }

  async getNextUnlockForUser(userId: string): Promise<any | null> {
    try {
      const user = await userService.getUserById(userId);
      if (!user) {
        return null;
      }

      const allSpells = await this.spellService.getAllSpells();
      const lockedSpells = allSpells.filter(spell => !user.spellsUnlocked.includes(spell.spellId));
      
      if (lockedSpells.length === 0) {
        return null; // All spells unlocked
      }

      // Sort by unlock requirement value (closest to unlock first)
      lockedSpells.sort((a, b) => {
        const aProgress = this.calculateUnlockProgress(user, a);
        const bProgress = this.calculateUnlockProgress(user, b);
        
        const aRatio = aProgress.current / aProgress.required;
        const bRatio = bProgress.current / bProgress.required;
        
        return bRatio - aRatio; // Higher progress ratio first
      });

      const nextSpell = lockedSpells[0];
      const progress = this.calculateUnlockProgress(user, nextSpell);

      return {
        spell: nextSpell,
        progress,
        percentage: Math.min(100, Math.round((progress.current / progress.required) * 100))
      };
    } catch (error) {
      console.error('Error getting next unlock:', error);
      return null;
    }
  }
}
