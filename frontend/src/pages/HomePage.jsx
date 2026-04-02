import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const HomePage = () => {
  const { user } = useAuthStore()

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center py-20"
      >
        <motion.h1
          className="text-6xl md:text-8xl font-bold mb-6"
          animate={{ 
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          style={{
            backgroundSize: '200% 200%',
            backgroundImage: 'linear-gradient(135deg, #00ff88, #00ffff, #ff00ff, #00ff88)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Code-Clash Arena
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto"
        >
          Battle opponents in real-time coding duels. Execute faster, code smarter, and dominate the arena!
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          {user ? (
            <>
              <Link
                to="/lobby"
                className="neon-button px-8 py-4 rounded-lg text-black font-bold text-lg"
              >
                ⚔️ Enter Battle Arena
              </Link>
              <Link
                to="/leaderboard"
                className="px-8 py-4 border-2 border-neon-green rounded-lg text-neon-green font-bold text-lg hover:bg-neon-green hover:text-black transition-all"
              >
                🏆 View Rankings
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/register"
                className="neon-button px-8 py-4 rounded-lg text-black font-bold text-lg"
              >
                🚀 Start Playing
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 border-2 border-neon-blue rounded-lg text-neon-blue font-bold text-lg hover:bg-neon-blue hover:text-black transition-all"
              >
                🔐 Login
              </Link>
            </>
          )}
        </motion.div>
      </motion.section>

      {/* Stats Section */}
      <motion.section
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        {[
          { number: '500+', label: 'Active Players', color: 'neon-green' },
          { number: '150+', label: 'Coding Puzzles', color: 'neon-blue' },
          { number: '10K+', label: 'Battles Fought', color: 'neon-purple' },
          { number: '24/7', label: 'Arena Open', color: 'neon-pink' }
        ].map((stat, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.05 }}
            className="glass-card p-6 text-center group"
          >
            <div className={`text-4xl font-bold text-${stat.color} group-hover:text-glow transition-all`}>
              {stat.number}
            </div>
            <div className="text-gray-400 mt-2">{stat.label}</div>
          </motion.div>
        ))}
      </motion.section>

      {/* Features Section */}
      <motion.section
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="space-y-12"
      >
        <h2 className="text-4xl font-bold text-center gradient-text">Battle Features</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: '⚡',
              title: 'Real-time Battles',
              description: 'Face off against opponents in live coding duels with instant feedback.',
              variant: 'neon'
            },
            {
              icon: '🎯',
              title: 'ELO Rankings',
              description: 'Climb the competitive ladder with our sophisticated matchmaking system.',
              variant: 'gradient'
            },
            {
              icon: '🔮',
              title: 'Magic Spells',
              description: 'Cast strategic spells to gain advantages and disrupt your opponent.',
              variant: 'glow'
            }
          ].map((feature, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.05, y: -5 }}
              className={`glass-card p-8 text-center group ${
                feature.variant === 'neon' ? 'border-neon-green' : 
                feature.variant === 'gradient' ? 'border-neon-blue' : 
                'border-neon-purple'
              }`}
            >
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3 gradient-text">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center py-16"
      >
        <div className="glass-card p-12 max-w-4xl mx-auto border-neon-green">
          <h2 className="text-3xl font-bold mb-4 gradient-text">Ready to Battle?</h2>
          <p className="text-gray-300 mb-8 text-lg">
            Join thousands of coders in the ultimate programming competition arena.
          </p>
          <Link
            to={user ? "/lobby" : "/register"}
            className="neon-button px-10 py-4 rounded-lg text-black font-bold text-xl inline-block"
          >
            {user ? "⚔️ Enter Arena" : "🚀 Join Now"}
          </Link>
        </div>
      </motion.section>
    </div>
  )
}

export default HomePage
