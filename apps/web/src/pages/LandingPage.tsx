import React from 'react'
import { useNavigate } from 'react-router-dom'

const LandingPage: React.FC = () => {
  const navigate = useNavigate()

  const handleGetStarted = () => {
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">Code-Clash</h1>
        <p className="text-xl mb-8">Arena of Algorithms</p>
        <button 
          onClick={handleGetStarted}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors"
        >
          Get Started
        </button>
      </div>
    </div>
  )
}

export default LandingPage
