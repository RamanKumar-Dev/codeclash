import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface PuzzlePanelProps {
  puzzle: {
    title: string
    description: string
    difficulty: 'EASY' | 'MEDIUM' | 'HARD'
    timeLimitMs: number
    testCases: Array<{
      input: string
      expectedOutput: string
      isHidden?: boolean
    }>
  }
  timeRemaining: number
}

const PuzzlePanel: React.FC<PuzzlePanelProps> = ({ puzzle, timeRemaining }) => {
  const [activeTab, setActiveTab] = useState(0)
  const visibleTestCases = puzzle.testCases.filter(tc => !tc.isHidden)
  const hiddenTestCaseCount = puzzle.testCases.filter(tc => tc.isHidden).length

  const getDifficultyColor = () => {
    switch (puzzle.difficulty) {
      case 'EASY': return 'bg-neon-green/20 text-neon-green border-neon-green'
      case 'MEDIUM': return 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow'
      case 'HARD': return 'bg-neon-red/20 text-neon-red border-neon-red'
    }
  }

  const getTimeColor = () => {
    if (timeRemaining > 120) return 'text-neon-green'
    if (timeRemaining > 60) return 'text-neon-yellow'
    return 'text-neon-red animate-pulse'
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="card-dark p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold neon-text">{puzzle.title}</h2>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full border text-sm font-semibold ${getDifficultyColor()}`}>
            {puzzle.difficulty}
          </span>
          <div className={`flex items-center gap-2 font-mono font-bold ${getTimeColor()}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {formatTime(timeRemaining)}
          </div>
        </div>
      </div>

      {/* Problem Description */}
      <div className="flex-1 overflow-y-auto mb-4">
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-lg"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={`${className} bg-dark-border px-1 py-0.5 rounded text-sm`} {...props}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {puzzle.description}
          </ReactMarkdown>
        </div>
      </div>

      {/* Test Cases */}
      <div className="border-t border-dark-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Test Cases</h3>
          {hiddenTestCaseCount > 0 && (
            <span className="text-xs text-dark-muted">
              +{hiddenTestCaseCount} hidden
            </span>
          )}
        </div>

        {/* Test case tabs */}
        <div className="flex gap-2 mb-3">
          {visibleTestCases.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-3 py-1 text-xs rounded transition-all ${
                activeTab === index
                  ? 'bg-neon-green/20 text-neon-green border border-neon-green'
                  : 'bg-dark-card text-dark-muted hover:text-dark-text border border-dark-border'
              }`}
            >
              Case {index + 1}
            </button>
          ))}
        </div>

        {/* Active test case */}
        {visibleTestCases[activeTab] && (
          <div className="space-y-3">
            <div className="bg-dark-bg p-3 rounded border border-dark-border">
              <div className="text-xs text-dark-muted mb-1">Input:</div>
              <pre className="font-mono text-sm whitespace-pre-wrap">
                {visibleTestCases[activeTab].input}
              </pre>
            </div>
            <div className="bg-dark-bg p-3 rounded border border-dark-border">
              <div className="text-xs text-dark-muted mb-1">Expected Output:</div>
              <pre className="font-mono text-sm whitespace-pre-wrap text-neon-green">
                {visibleTestCases[activeTab].expectedOutput}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Runtime hint */}
      <div className="mt-4 text-xs text-dark-muted border-t border-dark-border pt-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Time limit: {puzzle.timeLimitMs}ms • Memory limit: 128MB
        </div>
      </div>
    </div>
  )
}

export default PuzzlePanel
