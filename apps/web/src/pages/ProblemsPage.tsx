import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Problem } from '@code-clash/shared-types'

const ProblemsPage: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchProblems()
  }, [selectedDifficulty])

  const fetchProblems = async () => {
    try {
      setLoading(true)
      const url = selectedDifficulty === 'all' 
        ? '/api/problems' 
        : `/api/problems?difficulty=${selectedDifficulty}`
      
      const response = await fetch(url)
      const data = await response.json()
      setProblems(data.problems || [])
    } catch (error) {
      console.error('Failed to fetch problems:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProblems = problems.filter(problem =>
    problem.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    problem.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'bg-neon-green/20 text-neon-green border-neon-green'
      case 'MEDIUM': return 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow'
      case 'HARD': return 'bg-neon-red/20 text-neon-red border-neon-red'
      default: return 'bg-dark-card text-dark-muted border-dark-border'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold neon-text mb-2">Practice Problems</h1>
          <p className="text-dark-muted">Hone your coding skills with algorithmic challenges</p>
        </div>

        {/* Filters */}
        <div className="card-dark p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search problems by title or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded px-4 py-2 focus:outline-none focus:border-neon-green"
              />
            </div>

            {/* Difficulty Filter */}
            <div className="flex gap-2">
              {['all', 'EASY', 'MEDIUM', 'HARD'].map((difficulty) => (
                <button
                  key={difficulty}
                  onClick={() => setSelectedDifficulty(difficulty)}
                  className={`px-4 py-2 rounded border transition-all ${
                    selectedDifficulty === difficulty
                      ? 'bg-neon-green text-dark-bg border-neon-green'
                      : 'bg-dark-card text-dark-muted border-dark-border hover:text-dark-text'
                  }`}
                >
                  {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Problems Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProblems.map((problem, index) => (
            <motion.div
              key={problem.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card-dark p-6 hover:border-neon-green transition-all cursor-pointer group"
              onClick={() => window.open(`/arena?practice=${problem.id}`, '_blank')}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold group-hover:text-neon-green transition-colors">
                  {problem.title}
                </h3>
                <span className={`px-2 py-1 rounded text-xs font-semibold border ${getDifficultyColor(problem.difficulty)}`}>
                  {problem.difficulty}
                </span>
              </div>

              <p className="text-dark-muted text-sm mb-4 line-clamp-3">
                {problem.description.substring(0, 150)}...
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {problem.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-dark-bg rounded text-xs text-dark-muted"
                  >
                    {tag}
                  </span>
                ))}
                {problem.tags.length > 3 && (
                  <span className="px-2 py-1 bg-dark-bg rounded text-xs text-dark-muted">
                    +{problem.tags.length - 3}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-xs text-dark-muted">
                <div className="flex items-center gap-4">
                  <span>⏱️ {problem.timeLimitMs}ms</span>
                  <span>💾 {problem.memoryLimitMb}MB</span>
                </div>
                <button className="btn-primary text-sm py-1 px-3">
                  Practice
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredProblems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2">No problems found</h3>
            <p className="text-dark-muted">
              {searchTerm ? 'Try adjusting your search terms' : 'Check back later for new challenges'}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-dark p-4 text-center">
            <p className="text-2xl font-bold neon-text">{problems.length}</p>
            <p className="text-sm text-dark-muted">Total Problems</p>
          </div>
          <div className="card-dark p-4 text-center">
            <p className="text-2xl font-bold text-neon-green">
              {problems.filter(p => p.difficulty === 'EASY').length}
            </p>
            <p className="text-sm text-dark-muted">Easy</p>
          </div>
          <div className="card-dark p-4 text-center">
            <p className="text-2xl font-bold text-neon-yellow">
              {problems.filter(p => p.difficulty === 'MEDIUM').length}
            </p>
            <p className="text-sm text-dark-muted">Medium</p>
          </div>
          <div className="card-dark p-4 text-center">
            <p className="text-2xl font-bold text-neon-red">
              {problems.filter(p => p.difficulty === 'HARD').length}
            </p>
            <p className="text-sm text-dark-muted">Hard</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProblemsPage
