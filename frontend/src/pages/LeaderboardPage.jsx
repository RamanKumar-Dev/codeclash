import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

function LeaderboardPage() {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto"
    >
      <h1 className="text-4xl font-bold text-cyan-400 mb-8 text-center">Leaderboard</h1>
      
      <div className="bg-gray-800 rounded-lg p-8 border border-cyan-500/30">
        <p className="text-gray-300 text-center mb-6">
          Leaderboard functionality coming soon...
        </p>
        
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default LeaderboardPage
