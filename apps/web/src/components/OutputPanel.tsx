import React from 'react'
import { motion } from 'framer-motion'
import { CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface TestResult {
  passed: boolean
  input: string
  expectedOutput: string
  actualOutput?: string
  error?: string
  executionTime: number
}

interface OutputPanelProps {
  testResults: TestResult[]
  damageDealt: number
  opponentActions: Array<{
    type: 'submission' | 'spell'
    message: string
    timestamp: Date
  }>
  isRunning: boolean
  isSubmitting: boolean
}

const OutputPanel: React.FC<OutputPanelProps> = ({
  testResults,
  damageDealt,
  opponentActions,
  isRunning,
  isSubmitting
}) => {
  const passedTests = testResults.filter(r => r.passed).length
  const totalTests = testResults.length

  return (
    <div className="card-dark p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Output & Battle Log</h3>
        {totalTests > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {passedTests}/{totalTests} passed
            </span>
            <div className="w-12 h-2 bg-dark-border rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${
                  passedTests === totalTests ? 'bg-neon-green' : 
                  passedTests > 0 ? 'bg-neon-yellow' : 'bg-neon-red'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${(passedTests / totalTests) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Damage notification */}
        {damageDealt > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neon-red/20 border border-neon-red rounded-lg p-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-neon-red font-bold text-lg">-{damageDealt} 💥</span>
              <span className="text-sm">Damage dealt to opponent!</span>
            </div>
          </motion.div>
        )}

        {/* Status indicators */}
        {(isRunning || isSubmitting) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-3 bg-dark-bg rounded-lg border border-dark-border"
          >
            <div className="w-4 h-4 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">
              {isRunning ? 'Running tests...' : 'Submitting solution...'}
            </span>
          </motion.div>
        )}

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-dark-muted">Test Results</h4>
            {testResults.map((result, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`border rounded-lg p-3 ${
                  result.passed 
                    ? 'bg-neon-green/10 border-neon-green/30' 
                    : 'bg-neon-red/10 border-neon-red/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {result.passed ? (
                      <CheckIcon className="w-5 h-5 text-neon-green" />
                    ) : (
                      <XMarkIcon className="w-5 h-5 text-neon-red" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-mono">
                        Test Case {index + 1}
                      </span>
                      <span className="text-xs text-dark-muted">
                        {result.executionTime}ms
                      </span>
                    </div>
                    
                    {!result.passed && result.error && (
                      <div className="text-xs text-neon-red font-mono bg-dark-bg p-2 rounded">
                        {result.error}
                      </div>
                    )}
                    
                    {!result.passed && result.actualOutput && (
                      <div className="space-y-1">
                        <div className="text-xs">
                          <span className="text-dark-muted">Expected: </span>
                          <span className="text-neon-green font-mono">{result.expectedOutput}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-dark-muted">Actual: </span>
                          <span className="text-neon-red font-mono">{result.actualOutput}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Opponent Actions */}
        {opponentActions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-dark-muted">Opponent Activity</h4>
            {opponentActions.map((action, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 p-2 bg-dark-bg rounded border border-dark-border"
              >
                <div className="w-2 h-2 rounded-full bg-neon-red animate-pulse" />
                <span className="text-sm">{action.message}</span>
                <span className="text-xs text-dark-muted ml-auto">
                  {action.timestamp.toLocaleTimeString()}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {testResults.length === 0 && opponentActions.length === 0 && !isRunning && !isSubmitting && (
          <div className="flex flex-col items-center justify-center h-32 text-dark-muted">
            <ExclamationTriangleIcon className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Run tests to see results</p>
            <p className="text-xs mt-1">Battle activity will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default OutputPanel
