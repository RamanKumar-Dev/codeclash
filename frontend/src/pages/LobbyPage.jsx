import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

const LobbyPage = () => {
  const { user } = useAuthStore()
  const [inQueue, setInQueue] = useState(false)
  const [queueTime, setQueueTime] = useState(0)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Simulate connection status
    setConnected(true)
    
    let interval
    if (inQueue) {
      interval = setInterval(() => {
        setQueueTime(prev => prev + 1)
      }, 1000)
    }
    
    return () => clearInterval(interval)
  }, [inQueue])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleJoinQueue = () => {
    setInQueue(true)
    setQueueTime(0)
    toast.success('Joined matchmaking queue!')
    
    // Simulate finding a match after 10 seconds
    setTimeout(() => {
      setInQueue(false)
      toast.success('Match found! Redirecting to battle...')
      // In real implementation, this would navigate to battle page
    }, 10000)
  }

  const handleLeaveQueue = () => {
    setInQueue(false)
    setQueueTime(0)
    toast('Left matchmaking queue')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold gradient-text mb-2">Battle Lobby</h1>
        <p className="text-gray-400">Ready for combat, {user?.username}?</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Player Stats */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-6 border-neon-green"
        >
          <h2 className="text-2xl font-bold text-neon-green mb-4">Your Stats</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">ELO Rating</span>
              <span className="font-bold text-neon-blue">{user?.elo || 1000}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Wins</span>
              <span className="font-bold text-green-400">{user?.wins || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Losses</span>
              <span className="font-bold text-red-400">{user?.losses || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Win Rate</span>
              <span className="font-bold text-neon-purple">
                {user?.wins && user?.losses 
                  ? `${((user.wins / (user.wins + user.losses)) * 100).toFixed(1)}%`
                  : '0%'
                }
              </span>
            </div>
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
              <h2 className="text-2xl font-bold text-neon-blue mb-2">Matchmaking</h2>
              <p className="text-gray-400">
                {connected ? '✅ Connected to arena' : '🔌 Connecting...'}
              </p>
            </div>

            {!inQueue ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleJoinQueue}
                className="neon-button w-full py-4 px-6 rounded-lg text-black font-bold text-lg"
              >
                ⚔️ Find Battle
              </motion.button>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full mx-auto"
                  />
                  <p className="text-neon-blue mt-4">Searching for opponent...</p>
                  <p className="text-gray-400">Time in queue: {formatTime(queueTime)}</p>
                </div>
                <button
                  onClick={handleLeaveQueue}
                  className="w-full py-2 px-4 border border-red-500 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-6 border-neon-purple"
        >
          <h2 className="text-2xl font-bold text-neon-purple mb-4">Arena Status</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Players Online</span>
              <span className="font-bold text-neon-green">247</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">In Battle</span>
              <span className="font-bold text-neon-blue">42</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">In Queue</span>
              <span className="font-bold text-neon-purple">18</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Avg Wait Time</span>
              <span className="font-bold text-neon-pink">12s</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Battles */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border-cyber-border"
      >
        <h2 className="text-2xl font-bold gradient-text mb-4">Recent Battles</h2>
        <div className="text-center text-gray-400 py-8">
          <p>No recent battles</p>
          <p className="text-sm mt-2">Your battle history will appear here</p>
        </div>
      </motion.div>
    </div>
  )
}

export default LobbyPage
