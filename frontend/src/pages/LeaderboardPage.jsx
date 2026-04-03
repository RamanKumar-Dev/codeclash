import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const SERVER_URL = 'http://localhost:3001'

const TIER_COLORS = {
  Diamond: { color: '#00d4ff', icon: '💎', bg: 'rgba(0,212,255,0.1)' },
  Platinum: { color: '#00ff88', icon: '🔮', bg: 'rgba(0,255,136,0.1)' },
  Gold: { color: '#ffd700', icon: '🥇', bg: 'rgba(255,215,0,0.1)' },
  Silver: { color: '#c0c0c0', icon: '🥈', bg: 'rgba(192,192,192,0.1)' },
  Bronze: { color: '#cd7f32', icon: '🥉', bg: 'rgba(205,127,50,0.1)' },
}

function getTier(elo) {
  if (elo >= 2000) return 'Diamond'
  if (elo >= 1700) return 'Platinum'
  if (elo >= 1400) return 'Gold'
  if (elo >= 1200) return 'Silver'
  return 'Bronze'
}

const RankMedal = ({ rank }) => {
  if (rank === 1) return <span className="text-2xl">🥇</span>
  if (rank === 2) return <span className="text-2xl">🥈</span>
  if (rank === 3) return <span className="text-2xl">🥉</span>
  return <span className="text-gray-400 font-bold text-sm w-8 text-center">#{rank}</span>
}

function LeaderboardPage() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterTier, setFilterTier] = useState('All')

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${SERVER_URL}/leaderboard?limit=100`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPlayers(data)
    } catch (e) {
      setError('Could not load leaderboard. Is the server running?')
      toast.error('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const tiers = ['All', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze']
  const filtered = filterTier === 'All'
    ? players
    : players.filter((p) => getTier(p.elo) === filterTier)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-black gradient-text mb-1">🏆 Leaderboard</h1>
        <p className="text-gray-400">The best Code Clash warriors ranked by ELO</p>
      </div>

      {/* Tier filter */}
      <div className="flex gap-2 flex-wrap justify-center">
        {tiers.map((tier) => {
          const tc = TIER_COLORS[tier]
          return (
            <motion.button
              key={tier}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilterTier(tier)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                filterTier === tier
                  ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
              style={filterTier === tier && tc ? { borderColor: tc.color, color: tc.color, backgroundColor: tc.bg } : {}}
            >
              {tc ? `${tc.icon} ` : ''}{tier}
            </motion.button>
          )
        })}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchLeaderboard}
          className="px-4 py-1.5 rounded-full text-sm border border-gray-700 text-gray-400 hover:border-gray-500 transition-colors"
        >
          🔄 Refresh
        </motion.button>
      </div>

      {/* Top 3 Podium */}
      {!loading && !error && filtered.length >= 3 && filterTier === 'All' && (
        <div className="grid grid-cols-3 gap-4 mb-2">
          {[filtered[1], filtered[0], filtered[2]].map((player, i) => {
            if (!player) return <div key={i} />
            const rank = player.rank
            const tier = getTier(player.elo)
            const tc = TIER_COLORS[tier]
            const heights = ['h-24', 'h-32', 'h-20']
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`glass-card p-4 text-center flex flex-col items-center justify-end ${heights[i]}`}
                style={{ borderColor: tc.color, boxShadow: `0 0 20px ${tc.color}30` }}
              >
                <span className="text-2xl mb-1">{tc.icon}</span>
                <div className="font-bold text-sm text-white truncate w-full">{player.username}</div>
                <div className="text-xs font-bold" style={{ color: tc.color }}>{player.elo} ELO</div>
                <RankMedal rank={rank} />
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Leaderboard table */}
      <div className="glass-card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 px-4 py-3 bg-black/40 border-b border-gray-700/50 text-xs text-gray-500 font-semibold uppercase tracking-wider">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-4">Player</div>
          <div className="col-span-2 text-right">ELO</div>
          <div className="col-span-1 text-right">W</div>
          <div className="col-span-1 text-right">L</div>
          <div className="col-span-2 text-right">Win Rate</div>
          <div className="col-span-1 text-right">Streak</div>
        </div>

        {/* Rows */}
        {loading && (
          <div className="py-16 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"
            />
            <p className="text-gray-400">Loading rankings...</p>
          </div>
        )}

        {error && (
          <div className="py-16 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchLeaderboard}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <p>No players found in this tier yet.</p>
          </div>
        )}

        {!loading && !error && filtered.map((player, idx) => {
          const tier = getTier(player.elo)
          const tc = TIER_COLORS[tier]
          const isTop3 = player.rank <= 3

          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.5) }}
              className={`grid grid-cols-12 px-4 py-3 border-b border-gray-800/50 hover:bg-white/5 transition-colors items-center ${
                isTop3 ? 'bg-white/5' : ''
              }`}
              style={isTop3 ? { boxShadow: `inset 3px 0 0 ${tc.color}` } : {}}
            >
              {/* Rank */}
              <div className="col-span-1 text-center">
                <RankMedal rank={player.rank} />
              </div>

              {/* Player */}
              <div className="col-span-4 flex items-center gap-2 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: tc.bg, color: tc.color, border: `1px solid ${tc.color}40` }}
                >
                  {player.username[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white text-sm truncate">{player.username}</div>
                  <div className="text-xs flex items-center gap-1" style={{ color: tc.color }}>
                    <span>{tc.icon}</span>
                    <span>{tier}</span>
                  </div>
                </div>
              </div>

              {/* ELO */}
              <div className="col-span-2 text-right">
                <span className="font-bold text-sm" style={{ color: tc.color }}>{player.elo}</span>
              </div>

              {/* Wins */}
              <div className="col-span-1 text-right text-green-400 text-sm font-medium">{player.wins}</div>

              {/* Losses */}
              <div className="col-span-1 text-right text-red-400 text-sm font-medium">{player.losses}</div>

              {/* Win Rate */}
              <div className="col-span-2 text-right">
                <span className="text-sm text-gray-300 font-medium">{player.winRate}%</span>
              </div>

              {/* Streak */}
              <div className="col-span-1 text-right">
                {player.winStreak > 0 ? (
                  <span className="text-yellow-400 text-sm font-bold">🔥 {player.winStreak}</span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="text-center">
        <button
          onClick={() => navigate('/lobby')}
          className="px-6 py-2 border border-gray-600 text-gray-400 rounded-lg hover:border-cyan-500 hover:text-cyan-400 transition-colors text-sm"
        >
          ← Back to Lobby
        </button>
      </div>
    </motion.div>
  )
}

export default LeaderboardPage
