import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import LandingPage from './pages/LandingPage'
import ArenaPage from './pages/ArenaPage'
import LeaderboardPage from './pages/LeaderboardPage'
import DashboardPage from './pages/DashboardPage'
import ProblemsPage from './pages/ProblemsPage'

function App() {
  const initializeAuth = useAuthStore((state) => state.initialize)

  useEffect(() => {
    // Initialize auth from localStorage on app load
    initializeAuth()
  }, [initializeAuth])

  return (
    <div className="min-h-screen bg-dark-bg">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/arena" element={<ArenaPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/problems" element={<ProblemsPage />} />
      </Routes>
    </div>
  )
}

export default App
