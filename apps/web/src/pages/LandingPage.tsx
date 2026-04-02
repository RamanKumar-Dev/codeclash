import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { motion } from 'framer-motion'
import Background from '../components/ui/Background'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/arena')
    } else {
      navigate('/login')
    }
  }

  const features = [
    {
      icon: '⚔️',
      title: 'Real-time Combat',
      description: 'Battle opponents in real-time coding duels. Fast, correct code deals maximum damage.',
      badge: 'LIVE',
      glow: true
    },
    {
      icon: '🔮',
      title: 'Magic Spells',
      description: 'Use strategic spells like hints, time freeze, and slow to gain competitive advantage.',
      badge: 'STRATEGIC',
      variant: 'neon' as const
    },
    {
      icon: '🏆',
      title: 'Global Rankings',
      description: 'Climb the global leaderboard, earn XP, unlock spells, and prove your coding mastery.',
      badge: 'COMPETITIVE',
      variant: 'gradient' as const
    }
  ]

  const stats = [
    { number: '10K+', label: 'Active Players' },
    { number: '500K+', label: 'Battles Fought' },
    { number: '150+', label: 'Coding Puzzles' },
    { number: '24/7', label: 'Tournaments' }
  ]

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Background variant="cyberpunk" />
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-purple-500 rounded-full filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500 rounded-full filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div 
            className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Code-Clash
          </motion.div>
          
          <div className="flex gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/leaderboard')}>
              Leaderboard
            </Button>
            <Button variant="primary" size="sm" onClick={handleGetStarted}>
              {isAuthenticated ? 'Arena' : 'Login'}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 flex items-center justify-center px-6 py-20">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge variant="glow" className="mb-6">
              🚀 NOW IN BETA
            </Badge>
            
            <h1 className="text-6xl md:text-8xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-gradient">
                Code-Clash
              </span>
              <br />
              <span className="text-4xl md:text-6xl text-gray-300 font-light">
                Arena of Algorithms
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
              Experience the future of competitive programming. Real-time 1v1 coding battles where 
              <span className="text-cyan-400 font-bold"> speed</span>,{' '}
              <span className="text-purple-400 font-bold">accuracy</span>, and{' '}
              <span className="text-pink-400 font-bold">strategy</span> determine victory.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
              <Button 
                variant="primary" 
                size="xl" 
                glowEffect
                onClick={handleGetStarted}
                className="text-lg px-12 py-4"
              >
                {isAuthenticated ? '⚔️ Enter Arena' : '🚀 Start Coding'}
              </Button>
              
              <Button 
                variant="secondary" 
                size="xl"
                onClick={() => navigate('/leaderboard')}
                className="text-lg px-12 py-4"
              >
                🏆 View Rankings
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20"
          >
            {stats.map((stat, index) => (
              <Card key={index} variant="glass" className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  {stat.number}
                </div>
                <div className="text-gray-400 text-sm mt-2">{stat.label}</div>
              </Card>
            ))}
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="grid md:grid-cols-3 gap-8"
          >
            {features.map((feature, index) => (
              <Card 
                key={index} 
                variant={feature.variant || 'default'} 
                glow={feature.glow}
                className="text-center group hover:transform hover:scale-105 transition-all duration-300"
              >
                <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                
                {feature.badge && (
                  <Badge variant="neon" className="mb-4">
                    {feature.badge}
                  </Badge>
                )}
                
                <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  {feature.title}
                </h3>
                
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-gray-800 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Join the Revolution
              </h3>
              <p className="text-gray-400 mb-6">
                Be part of the next generation of competitive programming.
              </p>
              <div className="flex gap-4">
                <Button variant="neon" size="sm">
                  Discord
                </Button>
                <Button variant="ghost" size="sm">
                  GitHub
                </Button>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-gray-500 text-sm">
                Built with ❤️ using React, Node.js, Socket.io, and Docker
              </p>
              <p className="text-gray-600 text-xs mt-2">
                © 2024 Code-Clash. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  )
}

export default LandingPage
