import React from 'react'
import { motion } from 'framer-motion'
import { Spell } from '@code-clash/shared-types'

interface SpellWithStatus extends Spell {
  isUnlocked: boolean;
  cooldownUntil?: number;
  usesRemaining?: number;
}

interface SpellBarProps {
  spells: SpellWithStatus[]
  onCastSpell: (spellId: string) => void
  disabled?: boolean
  currentMana?: number
}

const SpellBar: React.FC<SpellBarProps> = ({ spells, onCastSpell, disabled = false, currentMana = 100 }) => {
  const getSpellIcon = (icon: string) => {
    return icon;
  }

  const getSpellColor = (effectType: string) => {
    switch (effectType) {
      case 'oracle_hint': return 'from-purple-500 to-pink-500'
      case 'time_freeze': return 'from-blue-500 to-cyan-500'
      case 'tower_shield': return 'from-green-500 to-emerald-500'
      case 'debug_ray': return 'from-yellow-500 to-orange-500'
      case 'double_damage': return 'from-red-500 to-rose-500'
      case 'code_wipe': return 'from-indigo-500 to-purple-500'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const isOnCooldown = (spell: SpellWithStatus) => {
    return spell.cooldownUntil && spell.cooldownUntil > Date.now()
  }

  const getCooldownProgress = (spell: SpellWithStatus) => {
    if (!spell.cooldownUntil) return 0
    const remaining = Math.max(0, spell.cooldownUntil - Date.now())
    const total = spell.cooldownSeconds * 1000
    return Math.min(100, (remaining / total) * 100)
  }

  const canCast = (spell: SpellWithStatus) => {
    return !disabled && 
           spell.isUnlocked && 
           (spell.usesRemaining === undefined || spell.usesRemaining > 0) && 
           !isOnCooldown(spell)
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <div className="flex gap-4 justify-center flex-wrap">
        {spells.map((spell, index) => {
          const usable = canCast(spell)
          const cooldown = isOnCooldown(spell)
          const cooldownProgress = getCooldownProgress(spell)

          return (
            <div key={spell.spellId} className="relative group">
              {/* Spell Card */}
              <motion.button
                whileHover={usable ? { scale: 1.05 } : {}}
                whileTap={usable ? { scale: 0.95 } : {}}
                onClick={() => usable && onCastSpell(spell.spellId)}
                disabled={!usable}
                className={`relative w-20 h-20 rounded-lg border-2 transition-all duration-200 ${
                  usable 
                    ? 'border-purple-500 cursor-pointer hover:shadow-lg hover:shadow-purple-500/30' 
                    : cooldown
                    ? 'border-gray-600 cursor-not-allowed opacity-60'
                    : 'border-gray-600 cursor-not-allowed opacity-40'
                }`}
              >
                {/* Background gradient */}
                <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${getSpellColor(spell.effect.type)} opacity-20`} />
                
                {/* Cooldown overlay */}
                {cooldown && (
                  <div className="absolute inset-0 rounded-lg bg-gray-900/80 flex items-center justify-center">
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          className="text-gray-700"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${2 * Math.PI * 28 * (1 - cooldownProgress / 100)}`}
                          className="text-red-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-red-500 font-bold text-sm">
                          {Math.ceil((cooldownProgress / 100) * spell.cooldownSeconds)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Spell content */}
                {!cooldown && (
                  <>
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="text-2xl mb-1">{getSpellIcon(spell.icon)}</span>
                      <span className="text-xs font-semibold truncate px-1 text-white">{spell.name}</span>
                    </div>

                    {/* Uses remaining indicator */}
                    {spell.usesRemaining !== undefined && spell.usesRemaining > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {spell.usesRemaining}
                      </div>
                    )}
                  </>
                )}
              </motion.button>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <div className="bg-gray-900 border border-purple-500 rounded-lg p-3 min-w-48 shadow-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{spell.icon}</span>
                    <span className="font-semibold text-white">{spell.name}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{spell.description}</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300">
                      Cooldown: {spell.cooldownSeconds}s
                    </span>
                    {spell.usesRemaining !== undefined && (
                      <span className={spell.usesRemaining > 0 ? 'text-green-400' : 'text-red-400'}>
                        Uses: {spell.usesRemaining}
                      </span>
                    )}
                  </div>
                  {!spell.isUnlocked && (
                    <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-yellow-400">
                      Locked
                    </div>
                  )}
                  {cooldown && (
                    <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-red-400">
                      Cooldown: {Math.ceil((cooldownProgress / 100) * spell.cooldownSeconds)}s
                    </div>
                  )}
                </div>
                {/* Tooltip arrow */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="w-2 h-2 bg-gray-900 border-r border-b border-purple-500 transform rotate-45" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Spell effects indicator */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-400">
          Click spells to cast powerful effects in battle
        </p>
      </div>
    </div>
  )
}

export default SpellBar
