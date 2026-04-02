import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LeaderboardEntry, 
  LeaderboardResponse, 
  LeaderboardQuery,
  RankTier,
  RANK_TIERS 
} from '@code-clash/shared-types'
import RankBadge from '../components/RankBadge'

const LeaderboardPage: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'season' | 'alltime' | 'weekly'>('season')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchLeaderboard()
  }, [activeTab, searchQuery, page])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        type: activeTab,
        page: page.toString(),
        limit: '50'
      })
      
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/leaderboard?${params}`)
      const data = await response.json()
      setLeaderboardData(data)
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400'
    if (rank === 2) return 'text-gray-300'
    if (rank === 3) return 'text-orange-400'
    if (rank <= 10) return 'text-purple-400'
    return 'text-gray-400'
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getPodiumPosition = (rank: number) => {
    if (rank === 1) return { scale: 1.2, y: -20, zIndex: 10 }
    if (rank === 2) return { scale: 1.1, y: -10, zIndex: 9 }
    if (rank === 3) return { scale: 1.05, y: -5, zIndex: 8 }
    return { scale: 1, y: 0, zIndex: 1 }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const top3 = leaderboardData?.entries.slice(0, 3) || []
  const remainingEntries = leaderboardData?.entries.slice(3) || []

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-2">
            Leaderboard
          </h1>
          <p className="text-gray-400 mb-6">Top coders in the arena</p>
          
          {/* Tabs */}
          <div className="flex justify-center gap-2 mb-6">
            {[
              { key: 'season' as const, label: 'Current Season' },
              { key: 'alltime' as const, label: 'All-Time' },
              { key: 'weekly' as const, label: 'Weekly' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-2 rounded-lg transition-all ${
                  activeTab === tab.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="max-w-md mx-auto">
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* Podium - Top 3 */}
        {top3.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex justify-center items-end gap-4 mb-8">
              {top3.map((entry, index) => {
                const position = getPodiumPosition(entry.rank)
                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: position.scale, y: position.y }}
                    transition={{ delay: index * 0.1 }}
                    className="text-center"
                    style={{ zIndex: position.zIndex }}
                  >
                    <div className="relative">
                      {/* Rank Badge */}
                      <div className={`absolute -top-2 -right-2 text-2xl ${getRankColor(entry.rank)}`}>
                        {getRankIcon(entry.rank)}
                      </div>
                      
                      {/* Avatar */}
                      <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-2">
                        <span className="text-2xl font-bold">
                          {entry.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      
                      {/* Username */}
                      <div className="font-semibold mb-1">{entry.username}</div>
                      
                      {/* Rank Badge */}
                      <RankBadge elo={entry.elo} size="sm" />
                      
                      {/* Stats */}
                      <div className="text-sm text-gray-400 mt-2">
                        <div>ELO: {entry.elo}</div>
                        <div>W/L: {entry.battlesWon}/{entry.battlesLost}</div>
                        <div>Win Rate: {entry.winRate}%</div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Current User's Rank */}
        {leaderboardData?.userRank && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 p-4 rounded-lg border border-purple-500 mb-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-purple-400">
                  #{leaderboardData.userRank.rank}
                </span>
                <div>
                  <p className="font-semibold">Your Rank</p>
                  <p className="text-sm text-gray-400">{leaderboardData.userRank.username}</p>
                </div>
              </div>
              <div className="text-right">
                <RankBadge elo={leaderboardData.userRank.elo} size="md" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Leaderboard Table */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800 rounded-lg overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700 border-b border-gray-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Rank Tier
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    ELO
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    W/L
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Win Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                <AnimatePresence>
                  {remainingEntries.map((entry, index) => (
                    <motion.tr
                      key={entry.userId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className={`hover:bg-gray-700/50 transition-colors ${
                        leaderboardData?.userRank?.userId === entry.userId ? 'bg-purple-500/10' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-lg font-bold ${getRankColor(entry.rank)}`}>
                            #{entry.rank}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3">
                            <span className="text-xs font-bold text-white">
                              {entry.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium">{entry.username}</span>
                          {leaderboardData?.userRank?.userId === entry.userId && (
                            <span className="ml-2 px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RankBadge elo={entry.elo} size="sm" showElo={false} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="font-bold text-purple-400">{entry.elo.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                        {entry.battlesWon}/{entry.battlesLost}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`font-medium ${
                          entry.winRate >= 60 ? 'text-green-400' : 
                          entry.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {entry.winRate}%
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {remainingEntries.length === 0 && top3.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No players found</p>
            </div>
          )}
        </motion.div>

        {/* Pagination */}
        {leaderboardData && leaderboardData.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
            >
              Previous
            </button>
            <span className="px-4 py-2 bg-gray-800 rounded-lg">
              Page {page} of {leaderboardData.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(leaderboardData.totalPages, page + 1))}
              disabled={page === leaderboardData.totalPages}
              className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        )}

        {/* Footer Stats */}
        <div className="mt-8 grid grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-400">
              {leaderboardData?.totalPlayers.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-400">Total Players</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-400">
              {leaderboardData?.entries.filter(e => e.elo >= 1700).length || 0}
            </p>
            <p className="text-sm text-gray-400">Grandmasters</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-400">
              {leaderboardData?.entries.filter(e => e.elo >= 1500).length || 0}
            </p>
            <p className="text-sm text-gray-400">Diamond+</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-400">
              {activeTab === 'season' ? 'Live' : 'Historical'}
            </p>
            <p className="text-sm text-gray-400">Season Status</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeaderboardPage
