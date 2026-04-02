import { Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LobbyPage from './pages/LobbyPage'
import BattlePage from './pages/BattlePage'
import LeaderboardPage from './pages/LeaderboardPage'
import { useAuthStore } from './stores/authStore'

function App() {
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen cyber-grid relative">
      {/* Floating orbs for cyberpunk effect */}
      <div className="floating-orb w-32 h-32 top-10 left-10"></div>
      <div className="floating-orb w-24 h-24 top-1/3 right-20" style={{ animationDelay: '2s' }}></div>
      <div className="floating-orb w-40 h-40 bottom-20 left-1/4" style={{ animationDelay: '4s' }}></div>
      
      <Navbar />
      
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-4 py-8"
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/lobby" element={user ? <LobbyPage /> : <LoginPage />} />
          <Route path="/battle" element={user ? <BattlePage /> : <LoginPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
      </motion.main>
    </div>
  )
}

export default App
