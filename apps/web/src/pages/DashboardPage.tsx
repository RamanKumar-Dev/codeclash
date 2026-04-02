import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { motion } from 'framer-motion'

const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || !user) {
    navigate('/')
    return null
  }

  const stats = [
    { label: 'Total XP', value: user.xp.toLocaleString(), color: 'text-neon-green' },
    { label: 'Current Rank', value: `#${user.rank}`, color: 'text-neon-blue' },
    { label: 'Spell Tokens', value: user.tokens, color: 'text-neon-purple' },
    { label: 'Win Rate', value: '68%', color: 'text-neon-yellow' }
  ]

  const recentMatches = [
    { id: '1', opponent: 'CodeMaster99', result: 'win', xp: '+120', damage: '85' },
    { id: '2', opponent: 'NinjaCoder', result: 'loss', xp: '+40', damage: '45' },
    { id: '3', opponent: 'AlgoWizard', result: 'win', xp: '+150', damage: '100' },
    { id: '4', opponent: 'ByteBender', result: 'win', xp: '+95', damage: '72' },
    { id: '5', opponent: 'PixelPusher', result: 'loss', xp: '+30', damage: '38' }
  ]

  const spells = [
    { name: 'Hint', icon: '🔮', uses: 3, cost: 50, unlocked: true },
    { name: 'Time Freeze', icon: '⏩', uses: 2, cost: 80, unlocked: true },
    { name: 'Slow', icon: '🛡️', uses: 1, cost: 100, unlocked: true },
    { name: 'Shield', icon: '🛡️', uses: 0, cost: 150, unlocked: false }
  ]

  return (
    <div className="min-h-screen bg-dark-bg p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold neon-text mb-2">Dashboard</h1>
          <p className="text-dark-muted">Welcome back, {user.username}!</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card-dark p-6 text-center"
            >
              <p className="text-sm text-dark-muted mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Recent Matches */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card-dark p-6"
          >
            <h2 className="text-xl font-bold mb-4 neon-text">Recent Matches</h2>
            <div className="space-y-3">
              {recentMatches.map((match, index) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-3 bg-dark-bg rounded border border-dark-border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      match.result === 'win' ? 'bg-neon-green' : 'bg-neon-red'
                    }`} />
                    <div>
                      <p className="font-medium">vs {match.opponent}</p>
                      <p className="text-xs text-dark-muted">
                        {match.damage} damage dealt
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      match.result === 'win' ? 'text-neon-green' : 'text-neon-red'
                    }`}>
                      {match.result === 'win' ? 'Victory' : 'Defeat'}
                    </p>
                    <p className="text-xs text-neon-green">{match.xp} XP</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/match/history')}
              className="w-full mt-4 btn-secondary"
            >
              View All Matches
            </button>
          </motion.div>

          {/* Spells Inventory */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card-dark p-6"
          >
            <h2 className="text-xl font-bold mb-4 neon-text">Spell Inventory</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {spells.map((spell, index) => (
                <div
                  key={spell.name}
                  className={`p-4 rounded border text-center ${
                    spell.unlocked
                      ? 'bg-dark-bg border-neon-green/30'
                      : 'bg-dark-bg/50 border-dark-muted opacity-50'
                  }`}
                >
                  <div className="text-2xl mb-2">{spell.icon}</div>
                  <p className="font-medium text-sm">{spell.name}</p>
                  <p className="text-xs text-dark-muted mb-1">
                    {spell.unlocked ? `${spell.uses} uses` : 'Locked'}
                  </p>
                  <p className="text-xs text-neon-blue">{spell.cost} tokens</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/arena')}
              className="w-full btn-primary"
            >
              Battle to Earn Tokens
            </button>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 grid md:grid-cols-3 gap-4"
        >
          <button
            onClick={() => navigate('/arena')}
            className="card-dark p-6 text-center hover:border-neon-green transition-all group"
          >
            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">⚔️</div>
            <p className="font-bold neon-text">Enter Arena</p>
            <p className="text-sm text-dark-muted">Find a match and battle</p>
          </button>

          <button
            onClick={() => navigate('/problems')}
            className="card-dark p-6 text-center hover:border-neon-green transition-all group"
          >
            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📚</div>
            <p className="font-bold neon-text">Practice</p>
            <p className="text-sm text-dark-muted">Hone your coding skills</p>
          </button>

          <button
            onClick={() => navigate('/leaderboard')}
            className="card-dark p-6 text-center hover:border-neon-green transition-all group"
          >
            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🏆</div>
            <p className="font-bold neon-text">Leaderboard</p>
            <p className="text-sm text-dark-muted">View global rankings</p>
          </button>
        </motion.div>
      </div>
    </div>
  )
}

export default DashboardPage
