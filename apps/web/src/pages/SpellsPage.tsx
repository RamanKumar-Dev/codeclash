import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Spell, 
  SpellUnlockNotification, 
  User 
} from '@code-clash/shared-types';

interface SpellWithProgress extends Spell {
  isUnlocked: boolean;
  unlockProgress: {
    current: number;
    required: number;
    type: string;
  };
}

interface SpellsPageProps {
  user: User;
}

const SpellsPage: React.FC<SpellsPageProps> = ({ user }) => {
  const [spells, setSpells] = useState<SpellWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpell, setSelectedSpell] = useState<SpellWithProgress | null>(null);
  const [unlockNotification, setUnlockNotification] = useState<SpellUnlockNotification | null>(null);

  useEffect(() => {
    fetchSpells();
    setupSpellUnlockListener();
  }, []);

  const fetchSpells = async () => {
    try {
      setLoading(true);
      // Mock API call - replace with actual API
      const mockSpells: SpellWithProgress[] = [
        {
          spellId: 'oracle_hint',
          name: 'Oracle Hint',
          icon: '🔮',
          description: 'Reveal one hidden test case input/output',
          cooldownSeconds: 999999,
          unlockCondition: { type: 'battles_won', value: 5 },
          effect: { type: 'oracle_hint' },
          isUnlocked: user.spellsUnlocked.includes('oracle_hint'),
          unlockProgress: {
            current: user.battlesWon,
            required: 5,
            type: 'battles_won'
          }
        },
        {
          spellId: 'time_freeze',
          name: 'Time Freeze',
          icon: '⏩',
          description: 'Pause the battle timer for 15 seconds',
          cooldownSeconds: 180,
          unlockCondition: { type: 'elo_reached', value: 1200 },
          effect: { type: 'time_freeze', duration: 15 },
          isUnlocked: user.spellsUnlocked.includes('time_freeze'),
          unlockProgress: {
            current: user.elo,
            required: 1200,
            type: 'elo_reached'
          }
        },
        {
          spellId: 'tower_shield',
          name: 'Tower Shield',
          icon: '🛡',
          description: 'Negate next 50 HP of damage received',
          cooldownSeconds: 120,
          unlockCondition: { type: 'battles_won', value: 10 },
          effect: { type: 'tower_shield', value: 50 },
          isUnlocked: user.spellsUnlocked.includes('tower_shield'),
          unlockProgress: {
            current: user.battlesWon,
            required: 10,
            type: 'battles_won'
          }
        },
        {
          spellId: 'debug_ray',
          name: 'Debug Ray',
          icon: '⚡',
          description: 'Force opponent\'s next submission to show a compile error',
          cooldownSeconds: 240,
          unlockCondition: { type: 'elo_reached', value: 1400 },
          effect: { type: 'debug_ray' },
          isUnlocked: user.spellsUnlocked.includes('debug_ray'),
          unlockProgress: {
            current: user.elo,
            required: 1400,
            type: 'elo_reached'
          }
        },
        {
          spellId: 'double_damage',
          name: 'Double Damage',
          icon: '🔥',
          description: 'Next submission deals 2x damage',
          cooldownSeconds: 300,
          unlockCondition: { type: 'battles_won', value: 25 },
          effect: { type: 'double_damage', value: 2 },
          isUnlocked: user.spellsUnlocked.includes('double_damage'),
          unlockProgress: {
            current: user.battlesWon,
            required: 25,
            type: 'battles_won'
          }
        },
        {
          spellId: 'code_wipe',
          name: 'Code Wipe',
          icon: '🌀',
          description: 'Clear opponent\'s output panel',
          cooldownSeconds: 180,
          unlockCondition: { type: 'elo_reached', value: 1600 },
          effect: { type: 'code_wipe' },
          isUnlocked: user.spellsUnlocked.includes('code_wipe'),
          unlockProgress: {
            current: user.elo,
            required: 1600,
            type: 'elo_reached'
          }
        }
      ];
      
      setSpells(mockSpells);
    } catch (error) {
      console.error('Error fetching spells:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSpellUnlockListener = () => {
    // Mock socket listener - replace with actual socket implementation
    // socket.on('spell:unlocked', (notification: SpellUnlockNotification) => {
    //   setUnlockNotification(notification);
    //   fetchSpells(); // Refresh spells list
    // });
  };

  const formatCooldown = (seconds: number): string => {
    if (seconds >= 3600) {
      return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    } else if (seconds >= 60) {
      return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getProgressPercentage = (current: number, required: number): number => {
    return Math.min(100, Math.round((current / required) * 100));
  };

  const getUnlockConditionText = (condition: any): string => {
    switch (condition.type) {
      case 'battles_won':
        return `Win ${condition.value} battles`;
      case 'elo_reached':
        return `Reach ${condition.value} ELO`;
      default:
        return `Unknown condition`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          Spell Collection
        </h1>
        <p className="text-gray-400">
          Unlock powerful spells to gain strategic advantages in battles
        </p>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-purple-400">
            {spells.filter(s => s.isUnlocked).length}/{spells.length}
          </div>
          <div className="text-sm text-gray-400">Spells Unlocked</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-blue-400">{user.elo}</div>
          <div className="text-sm text-gray-400">Current ELO</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-green-400">{user.battlesWon}</div>
          <div className="text-sm text-gray-400">Battles Won</div>
        </div>
      </div>

      {/* Spells Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {spells.map((spell, index) => (
          <motion.div
            key={spell.spellId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative bg-gray-800 rounded-lg p-6 border transition-all cursor-pointer ${
              spell.isUnlocked 
                ? 'border-purple-500 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/20' 
                : 'border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => setSelectedSpell(spell)}
          >
            {/* Spell Icon and Name */}
            <div className="flex items-center mb-4">
              <div className={`text-4xl mr-3 ${spell.isUnlocked ? '' : 'grayscale opacity-50'}`}>
                {spell.icon}
              </div>
              <div>
                <h3 className={`text-xl font-bold ${spell.isUnlocked ? 'text-white' : 'text-gray-500'}`}>
                  {spell.name}
                </h3>
                <div className={`text-sm ${spell.isUnlocked ? 'text-purple-400' : 'text-gray-600'}`}>
                  {spell.isUnlocked ? 'Unlocked' : 'Locked'}
                </div>
              </div>
            </div>

            {/* Description */}
            <p className={`text-sm mb-4 ${spell.isUnlocked ? 'text-gray-300' : 'text-gray-600'}`}>
              {spell.description}
            </p>

            {/* Cooldown */}
            {spell.isUnlocked && (
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-1">Cooldown</div>
                <div className="text-sm font-mono text-blue-400">
                  {formatCooldown(spell.cooldownSeconds)}
                </div>
              </div>
            )}

            {/* Unlock Progress */}
            {!spell.isUnlocked && (
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-1">
                  {getUnlockConditionText(spell.unlockCondition)}
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                    style={{ width: `${getProgressPercentage(spell.unlockProgress.current, spell.unlockProgress.required)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {spell.unlockProgress.current} / {spell.unlockProgress.required}
                </div>
              </div>
            )}

            {/* Hover Effect */}
            {spell.isUnlocked && (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-none"></div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Spell Detail Modal */}
      <AnimatePresence>
        {selectedSpell && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50"
            onClick={() => setSelectedSpell(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center mb-4">
                <div className={`text-5xl mr-4 ${selectedSpell.isUnlocked ? '' : 'grayscale opacity-50'}`}>
                  {selectedSpell.icon}
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${selectedSpell.isUnlocked ? 'text-white' : 'text-gray-500'}`}>
                    {selectedSpell.name}
                  </h2>
                  <div className={`text-sm ${selectedSpell.isUnlocked ? 'text-purple-400' : 'text-gray-600'}`}>
                    {selectedSpell.isUnlocked ? 'Unlocked' : 'Locked'}
                  </div>
                </div>
              </div>

              <p className={`text-gray-300 mb-4 ${selectedSpell.isUnlocked ? '' : 'text-gray-600'}`}>
                {selectedSpell.description}
              </p>

              {selectedSpell.isUnlocked ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-400">Cooldown</div>
                    <div className="text-lg font-mono text-blue-400">
                      {formatCooldown(selectedSpell.cooldownSeconds)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Effect</div>
                    <div className="text-sm text-gray-300 capitalize">
                      {selectedSpell.effect.type.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-400">Unlock Requirement</div>
                    <div className="text-sm text-gray-300">
                      {getUnlockConditionText(selectedSpell.unlockCondition)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Progress</div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                        style={{ 
                          width: `${getProgressPercentage(selectedSpell.unlockProgress.current, selectedSpell.unlockProgress.required)}%` 
                        }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {selectedSpell.unlockProgress.current} / {selectedSpell.unlockProgress.required}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedSpell(null)}
                className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unlock Notification Modal */}
      <AnimatePresence>
        {unlockNotification && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-8 right-8 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-lg shadow-2xl z-50 max-w-sm"
          >
            <div className="flex items-center mb-2">
              <div className="text-4xl mr-3 animate-bounce">
                {unlockNotification.spell.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold">Spell Unlocked!</h3>
                <p className="text-sm opacity-90">{unlockNotification.spell.name}</p>
              </div>
            </div>
            <p className="text-sm opacity-80 mb-4">
              {unlockNotification.spell.description}
            </p>
            <button
              onClick={() => setUnlockNotification(null)}
              className="w-full bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded transition-colors"
            >
              Awesome!
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpellsPage;
