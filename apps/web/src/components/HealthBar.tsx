import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface HealthBarProps {
  currentHp: number
  maxHp: number
  playerName: string
  isOpponent?: boolean
  showDamage?: boolean
  lastDamage?: number
}

const HealthBar: React.FC<HealthBarProps> = ({
  currentHp,
  maxHp,
  playerName,
  isOpponent = false,
  showDamage = false,
  lastDamage = 0
}) => {
  const [displayHp, setDisplayHp] = useState(currentHp)
  const [shake, setShake] = useState(false)
  const [floatingDamage, setFloatingDamage] = useState<number | null>(null)

  const healthPercentage = (displayHp / maxHp) * 100
  
  const getHealthColor = () => {
    if (healthPercentage > 60) return 'bg-neon-green'
    if (healthPercentage > 30) return 'text-neon-yellow'
    return 'bg-neon-red'
  }

  const getBarColor = () => {
    if (healthPercentage > 60) return 'bg-neon-green/80'
    if (healthPercentage > 30) return 'bg-neon-yellow/80'
    return 'bg-neon-red/80'
  }

  useEffect(() => {
    if (currentHp < displayHp) {
      // Taking damage
      setShake(true)
      setFloatingDamage(lastDamage)
      
      setTimeout(() => {
        setShake(false)
      }, 500)

      setTimeout(() => {
        setFloatingDamage(null)
      }, 2000)

      // Animate HP decrease
      setTimeout(() => {
        setDisplayHp(currentHp)
      }, 200)
    } else if (currentHp > displayHp) {
      // Healing (unlikely in battle but just in case)
      setDisplayHp(currentHp)
    }
  }, [currentHp, displayHp, lastDamage])

  return (
    <div className="relative">
      {/* Floating damage number */}
      {floatingDamage && floatingDamage > 0 && (
        <motion.div
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -60, scale: 1.5 }}
          transition={{ duration: 2, ease: 'easeOut' }}
          className={`absolute -top-8 left-1/2 transform -translate-x-1/2 font-bold text-2xl z-10 ${
            isOpponent ? 'text-neon-green' : 'text-neon-red'
          }`}
        >
          -{floatingDamage} 💥
        </motion.div>
      )}

      <div className={`space-y-2 ${shake ? 'animate-shake' : ''}`}>
        {/* Player name and HP text */}
        <div className="flex justify-between items-center">
          <span className={`font-semibold ${isOpponent ? 'text-neon-red' : 'text-neon-green'}`}>
            {playerName}
          </span>
          <span className={`text-sm font-mono ${getHealthColor()}`}>
            {displayHp} / {maxHp}
          </span>
        </div>

        {/* Health bar container */}
        <div className="relative">
          <div className="w-full h-6 bg-dark-border rounded-full overflow-hidden">
            {/* Health bar fill */}
            <motion.div
              className={`h-full ${getBarColor()} transition-all duration-500 ease-out`}
              initial={{ width: `${healthPercentage}%` }}
              animate={{ width: `${healthPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            
            {/* HP percentage overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow-lg">
                {Math.round(healthPercentage)}%
              </span>
            </div>
          </div>

          {/* Decorative corners */}
          <div className="absolute -inset-1 border border-neon-green/20 rounded-full pointer-events-none" />
          {healthPercentage <= 30 && (
            <motion.div
              className="absolute -inset-1 border border-neon-red rounded-full pointer-events-none"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default HealthBar
