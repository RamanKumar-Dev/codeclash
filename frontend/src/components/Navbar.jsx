import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const Navbar = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="glass-card border-cyber-border sticky top-0 z-50 backdrop-blur-xl"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-neon-green to-neon-blue rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform">
              <span className="text-black font-bold text-xl">⚔️</span>
            </div>
            <h1 className="text-2xl font-bold gradient-text group-hover:text-glow transition-all">
              Code-Clash Arena
            </h1>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="text-gray-300 hover:text-neon-green transition-colors hover:text-glow"
            >
              Home
            </Link>
            <Link
              to="/leaderboard"
              className="text-gray-300 hover:text-neon-green transition-colors hover:text-glow"
            >
              Leaderboard
            </Link>
            {user && (
              <>
                <Link
                  to="/lobby"
                  className="text-gray-300 hover:text-neon-green transition-colors hover:text-glow"
                >
                  Battle Arena
                </Link>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Player</div>
                    <div className="font-semibold text-neon-blue">{user.username}</div>
                    <div className="text-xs text-neon-green">ELO: {user.elo}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-500/20 border border-red-500 rounded-lg hover:bg-red-500/30 transition-colors text-red-400"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button className="text-gray-300 hover:text-neon-green">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}

export default Navbar
