import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useSocketStore } from '../stores/socketStore'
import toast from 'react-hot-toast'

const LobbyPage = () => {
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const {
    socket, connected, authenticated, inQueue, queuePosition,
    battle, battleStatus, connect, joinQueue, leaveQueue,
  } = useSocketStore()

  // Connect socket on mount
  useEffect(() => {
    if (token && !socket) {
      connect(token)
    } else if (token && socket && !connected) {
      connect(token)
    }
  }, [token])

  // Navigate to battle when match found
  useEffect(() => {
    if (battle && battleStatus !== 'idle') {
      navigate('/battle')
    }
  }, [battle, battleStatus])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleJoinQueue = () => {
    if (!authenticated) {
      toast.error('Not connected to server. Please wait...')
      return
    }
    joinQueue()
    toast.success('Joined matchmaking queue!')
  }

  const handleLeaveQueue = () => {
    leaveQueue()
    toast('Left matchmaking queue')
  }

  const winRate = user?.wins || user?.losses
    ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
    : '0.0'

  const tier = (() => {
    const elo = user?.elo || 1000
    if (elo >= 2000) return { name: 'Diamond', color: '#00d4ff', icon: '💎' }
    if (elo >= 1700) return { name: 'Platinum', color: '#00ff88', icon: '🔮' }
    if (elo >= 1400) return { name: 'Gold', color: '#ffd700', icon: '🥇' }
    if (elo >= 1200) return { name: 'Silver', color: '#c0c0c0', icon: '🥈' }
    return { name: 'Bronze', color: '#cd7f32', icon: '🥉' }
  })()

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold gradient-text mb-2">⚔️ Battle Lobby</h1>
        <p className="text-gray-400">Ready for combat, <span className="text-cyan-400 font-bold">{user?.username}</span>?</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player Stats */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-6 border-neon-green"
        >
          <h2 className="text-xl font-bold text-neon-green mb-4">Your Profile</h2>
          
          {/* Tier badge */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-black/30">
            <span className="text-3xl">{tier.icon}</span>
            <div>
              <div className="font-bold" style={{ color: tier.color }}>{tier.name}</div>
              <div className="text-xs text-gray-400">Current Tier</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">ELO Rating</span>
              <span className="font-bold text-neon-blue text-lg">{user?.elo || 1000}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Wins</span>
              <span className="font-bold text-green-400">{user?.wins || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Losses</span>
              <span className="font-bold text-red-400">{user?.losses || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Win Rate</span>
              <span className="font-bold text-neon-purple">{winRate}%</span>
            </div>
            {user?.winStreak > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Win Streak</span>
                <span className="font-bold text-yellow-400">🔥 {user.winStreak}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Matchmaking */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 border-neon-blue text-center"
        >
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-neon-blue mb-2">Matchmaking</h2>
              <div className="flex items-center justify-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-gray-400">
                  {connected ? (authenticated ? '✅ Connected & Ready' : '🔐 Authenticating...') : '🔌 Connecting...'}
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!inQueue ? (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="space-y-4"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleJoinQueue}
                    disabled={!authenticated}
                    className="neon-button w-full py-4 px-6 rounded-lg text-black font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ⚔️ Find Battle
                  </motion.button>
                  <p className="text-xs text-gray-500">ELO-based matchmaking · 1v1 coding duels</p>
                </motion.div>
              ) : (
                <motion.div
                  key="searching"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="w-14 h-14 border-4 border-neon-blue border-t-transparent rounded-full mx-auto"
                    />
                    <p className="text-neon-blue mt-4 font-bold">Searching for opponent...</p>
                    {queuePosition && (
                      <>
                        <p className="text-gray-400 text-sm">Position: #{queuePosition.position} of {queuePosition.total}</p>
                        <p className="text-gray-500 text-sm">Wait: {formatTime(queuePosition.waitSeconds)}</p>
                      </>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLeaveQueue}
                    className="w-full py-2 px-4 border border-red-500 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    Cancel Search
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Game Info */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-6 border-neon-purple"
        >
          <h2 className="text-xl font-bold text-neon-purple mb-4">How It Works</h2>
          <div className="space-y-4 text-sm">
            {[
              { icon: '🎯', title: 'Get Matched', desc: 'Paired with a player of similar ELO rating' },
              { icon: '💻', title: 'Solve Problems', desc: 'Beat the coding challenge faster than your opponent' },
              { icon: '⚡', title: 'Deal Damage', desc: 'Correct submissions deal HP damage to your opponent' },
              { icon: '🪄', title: 'Cast Spells', desc: 'Use mana to freeze, slow, or get hints' },
              { icon: '🏆', title: 'Win ELO', desc: 'Victory grants ELO points and achievements' },
            ].map((item) => (
              <div key={item.icon} className="flex gap-3 items-start">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <div className="font-semibold text-white">{item.title}</div>
                  <div className="text-gray-400">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default LobbyPage
