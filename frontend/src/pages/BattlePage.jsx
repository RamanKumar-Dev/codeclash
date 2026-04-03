import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { useAuthStore } from '../stores/authStore'
import { useSocketStore } from '../stores/socketStore'
import toast from 'react-hot-toast'

const LANGUAGE_OPTIONS = [
  { id: 63, name: 'JavaScript', monaco: 'javascript' },
  { id: 71, name: 'Python', monaco: 'python' },
  { id: 54, name: 'C++', monaco: 'cpp' },
  { id: 62, name: 'Java', monaco: 'java' },
  { id: 74, name: 'TypeScript', monaco: 'typescript' },
]

const STARTER_CODE = {
  63: `// JavaScript Solution\nfunction solution(/* args */) {\n  // Your code here\n}`,
  71: `# Python Solution\ndef solution(args):\n    # Your code here\n    pass`,
  54: `// C++ Solution\n#include <bits/stdc++.h>\nusing namespace std;\n\nint solution(/* args */) {\n  // Your code here\n}`,
  62: `// Java Solution\nclass Solution {\n  public int solution(/* args */) {\n    // Your code here\n  }\n}`,
  74: `// TypeScript Solution\nfunction solution(/* args */): any {\n  // Your code here\n}`,
}

const HPBar = ({ current, max = 500, label, color, isOpponent }) => {
  const pct = Math.max(0, (current / max) * 100)
  const barColor = pct > 60 ? color : pct > 30 ? '#f59e0b' : '#ef4444'

  return (
    <div className={`flex flex-col gap-1 ${isOpponent ? 'items-end' : 'items-start'} flex-1`}>
      <div className={`flex items-center gap-2 ${isOpponent ? 'flex-row-reverse' : ''}`}>
        <span className="text-xs font-bold text-gray-400">{label}</span>
        <span className="text-sm font-bold" style={{ color: barColor }}>{current} HP</span>
      </div>
      <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}60` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

const SpellButton = ({ id, icon, name, cost, onClick, canAfford }) => (
  <motion.button
    whileHover={{ scale: canAfford ? 1.1 : 1 }}
    whileTap={{ scale: canAfford ? 0.9 : 1 }}
    onClick={() => canAfford && onClick(id)}
    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
      canAfford
        ? 'border-purple-500/50 hover:border-purple-400 hover:bg-purple-500/20 cursor-pointer'
        : 'border-gray-700 opacity-40 cursor-not-allowed'
    }`}
    title={`${name} (${cost} mana)`}
  >
    <span className="text-xl">{icon}</span>
    <span className="text-gray-300">{name}</span>
    <span className="text-purple-400 font-bold">{cost}✨</span>
  </motion.button>
)

function BattlePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    battle, battleStatus, countdownSeconds, hp,
    lastDamageEvent, battleResult, submitResult, spellEffects,
    submitCode, castSpell, forfeit, resetBattle, clearSubmitResult,
  } = useSocketStore()

  const [code, setCode] = useState('')
  const [langId, setLangId] = useState(63)
  const [mana, setMana] = useState(100)
  const [timeLeft, setTimeLeft] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [activeTab, setActiveTab] = useState('problem') // 'problem' | 'testcases'
  const timerRef = useRef(null)

  // Redirect to lobby if no battle
  useEffect(() => {
    if (!battle && battleStatus === 'idle') {
      navigate('/lobby')
    }
  }, [battle, battleStatus])

  // Initialize code when language changes
  useEffect(() => {
    setCode(STARTER_CODE[langId] || '')
  }, [langId])

  // Timer countdown
  useEffect(() => {
    if (battle && battleStatus === 'active') {
      setTimeLeft(battle.timeLimitSeconds)
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [battleStatus, battle])

  // Show toasts for damage events
  useEffect(() => {
    if (lastDamageEvent && lastDamageEvent.damage > 0) {
      toast.success(`💥 ${lastDamageEvent.attackerName} dealt ${lastDamageEvent.damage} damage!`, {
        icon: '⚔️', duration: 3000
      })
    }
  }, [lastDamageEvent])

  // Handle submit result
  useEffect(() => {
    if (submitResult && !submitResult.judging) {
      setShowResult(true)
      if (submitResult.error) {
        toast.error(submitResult.error)
      } else if (submitResult.hint) {
        toast.success(submitResult.hint, { duration: 8000, icon: '💡' })
      } else if (submitResult.passed) {
        toast.success(`✅ ${submitResult.passedTests}/${submitResult.totalTests} tests passed! Dealt ${submitResult.damage} damage!`, { duration: 4000 })
      } else {
        toast.error(`❌ ${submitResult.passedTests}/${submitResult.totalTests} tests passed.`)
      }
    }
  }, [submitResult])

  // Show spell effects
  useEffect(() => {
    spellEffects.forEach((effect) => {
      toast(`🧙 ${effect.casterName} cast ${effect.spellType.replace('_', ' ')} on you!`, {
        icon: '⚡', duration: 4000
      })
    })
  }, [spellEffects])

  const handleSubmit = () => {
    if (!battle?.roomId || battleStatus !== 'active') return
    submitCode(battle.roomId, code, langId)
    clearSubmitResult()
    setShowResult(false)
  }

  const handleSpell = (spellType) => {
    if (!battle?.roomId) return
    castSpell(battle.roomId, spellType)
    const costs = { hint: 30, time_freeze: 50, slow: 40 }
    setMana((m) => Math.max(0, m - (costs[spellType] || 0)))
    toast(`🪄 ${spellType.replace('_', ' ')} cast!`, { duration: 2000 })
  }

  const handleForfeit = () => {
    if (window.confirm('Are you sure you want to forfeit this battle?')) {
      forfeit(battle?.roomId)
    }
  }

  const formatTime = (sec) => {
    if (sec === null || sec === undefined) return '--:--'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const puzzle = battle?.puzzle

  // Countdown screen
  if (battleStatus === 'countdown') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
        <motion.div className="text-center">
          <p className="text-2xl text-gray-300 mb-4">Battle starts in</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={countdownSeconds}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-9xl font-black text-neon-blue"
              style={{ textShadow: '0 0 40px #00d4ff' }}
            >
              {countdownSeconds || '⚔️'}
            </motion.div>
          </AnimatePresence>
          {battle?.opponentName && (
            <p className="text-xl text-gray-400 mt-4">
              vs <span className="text-neon-green font-bold">{battle.opponentName}</span>
              <span className="text-gray-500"> (ELO: {battle.opponentElo})</span>
            </p>
          )}
        </motion.div>
      </div>
    )
  }

  // Battle ended screen
  if (battleStatus === 'ended' && battleResult) {
    const isWinner = battleResult.winnerId === user?.id
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-50">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-10 text-center max-w-md w-full mx-4"
        >
          <motion.div
            animate={{ rotate: isWinner ? [0, -10, 10, 0] : 0 }}
            transition={{ repeat: 3, duration: 0.3 }}
            className="text-8xl mb-4"
          >
            {isWinner ? '🏆' : '💀'}
          </motion.div>
          <h2 className={`text-4xl font-black mb-2 ${isWinner ? 'text-yellow-400' : 'text-red-400'}`}>
            {isWinner ? 'VICTORY!' : 'DEFEAT'}
          </h2>
          <p className="text-gray-400 mb-6">
            {isWinner
              ? `You defeated ${battle?.opponentName || 'your opponent'}!`
              : `You were defeated by ${battleResult.winnerName}!`}
          </p>

          {/* ELO change */}
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <div className={`text-2xl font-bold ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                {isWinner ? `+${battleResult.winnerEloChange}` : `${battleResult.loserEloChange}`}
              </div>
              <div className="text-xs text-gray-500">ELO Change</div>
            </div>
          </div>

          {/* Achievements */}
          {battleResult.newAchievements?.length > 0 && (
            <div className="mb-6">
              <p className="text-yellow-400 font-bold mb-2">🎖️ New Achievements!</p>
              {battleResult.newAchievements.map((a) => (
                <div key={a.id} className="flex items-center gap-2 justify-center text-sm text-gray-300">
                  <span>{a.icon}</span>
                  <span>{a.name}</span>
                </div>
              ))}
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { resetBattle(); navigate('/lobby') }}
            className="neon-button px-8 py-3 rounded-lg text-black font-bold"
          >
            Back to Lobby
          </motion.button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden" style={{ paddingTop: '0' }}>
      {/* ── Top Bar: HP + Timer ── */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-900/80 border-b border-gray-700/50 backdrop-blur-sm">
        {/* My HP */}
        <HPBar
          current={hp.my}
          label={user?.username || 'You'}
          color="#00ff88"
          isOpponent={false}
        />

        {/* Timer */}
        <div className="flex flex-col items-center min-w-[80px]">
          <div
            className={`text-2xl font-black tabular-nums ${
              timeLeft !== null && timeLeft < 60 ? 'text-red-400' : 'text-neon-blue'
            }`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="text-xs text-gray-500">Time Left</div>
        </div>

        {/* Opponent HP */}
        <HPBar
          current={hp.opponent}
          label={battle?.opponentName || 'Opponent'}
          color="#00d4ff"
          isOpponent={true}
        />
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Panel: Problem + Spells ── */}
        <div className="w-[380px] min-w-[300px] flex flex-col border-r border-gray-700/50 bg-gray-900/50">
          {/* Tabs */}
          <div className="flex border-b border-gray-700/50">
            {['problem', 'testcases'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-neon-blue border-b-2 border-neon-blue bg-neon-blue/5'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'problem' ? '📋 Problem' : '🧪 Test Cases'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {activeTab === 'problem' && puzzle && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{puzzle.title}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    puzzle.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                    puzzle.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {puzzle.difficulty}
                  </span>
                </div>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{puzzle.description}</p>

                {puzzle.examples?.length > 0 && (
                  <div>
                    <p className="text-gray-400 font-semibold mb-2">Examples:</p>
                    {puzzle.examples.map((ex, i) => (
                      <div key={i} className="bg-black/40 rounded-lg p-3 mb-2 border border-gray-700/50 font-mono text-xs">
                        <div className="text-gray-400">Input: <span className="text-cyan-300">{ex.input}</span></div>
                        <div className="text-gray-400">Output: <span className="text-green-300">{ex.output || ex.expectedOutput}</span></div>
                        {ex.explanation && <div className="text-gray-500 mt-1">{ex.explanation}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {puzzle.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {puzzle.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'testcases' && puzzle?.testCases && (
              <div className="space-y-3">
                <p className="text-gray-400 text-xs">Visible test cases (hidden cases used in Submit)</p>
                {puzzle.testCases.map((tc, i) => (
                  <div key={i} className="bg-black/40 rounded-lg p-3 border border-gray-700/50 font-mono text-xs">
                    <div className="text-gray-400 mb-1">Test {i + 1}</div>
                    <div className="text-gray-400">Input: <span className="text-cyan-300">{tc.input}</span></div>
                    <div className="text-gray-400">Expected: <span className="text-green-300">{tc.expectedOutput}</span></div>
                  </div>
                ))}
              </div>
            )}

            {!puzzle && (
              <div className="text-gray-500 text-center py-8">Loading problem...</div>
            )}
          </div>

          {/* Spells */}
          <div className="border-t border-gray-700/50 p-3 bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-semibold">✨ Spells</span>
              <span className="text-xs text-purple-400 font-bold">{mana}/100 mana</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full mb-3 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-purple-500"
                animate={{ width: `${mana}%` }}
                style={{ boxShadow: '0 0 8px #a855f760' }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SpellButton id="hint" icon="💡" name="Hint" cost={30} onClick={handleSpell} canAfford={mana >= 30} />
              <SpellButton id="time_freeze" icon="❄️" name="Freeze" cost={50} onClick={handleSpell} canAfford={mana >= 50} />
              <SpellButton id="slow" icon="🐌" name="Slow" cost={40} onClick={handleSpell} canAfford={mana >= 40} />
            </div>
          </div>
        </div>

        {/* ── Right Panel: Editor ── */}
        <div className="flex-1 flex flex-col">
          {/* Editor toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/70 border-b border-gray-700/50">
            <select
              value={langId}
              onChange={(e) => setLangId(Number(e.target.value))}
              className="bg-gray-800 border border-gray-600 text-sm text-white rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>

            <div className="flex-1" />

            {/* Submit result indicator */}
            {submitResult?.judging && (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-xs text-yellow-400 font-bold"
              >
                ⏳ Judging...
              </motion.span>
            )}
            {submitResult && !submitResult.judging && !submitResult.error && submitResult.passedTests !== undefined && (
              <span className={`text-xs font-bold ${submitResult.passedTests === submitResult.totalTests ? 'text-green-400' : 'text-red-400'}`}>
                {submitResult.passedTests}/{submitResult.totalTests} tests
              </span>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={battleStatus !== 'active' || submitResult?.judging}
              className="px-5 py-1.5 bg-neon-green text-black font-bold text-sm rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 12px #00ff8860' }}
            >
              ⚡ Submit
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleForfeit}
              className="px-3 py-1.5 border border-red-500/50 text-red-400 text-sm rounded-lg hover:bg-red-500/10 transition-colors"
            >
              🏳️ Forfeit
            </motion.button>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={LANGUAGE_OPTIONS.find((l) => l.id === langId)?.monaco || 'javascript'}
              value={code}
              onChange={(v) => setCode(v || '')}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                padding: { top: 12, bottom: 12 },
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
              }}
            />
          </div>

          {/* Submit result panel */}
          <AnimatePresence>
            {showResult && submitResult && !submitResult.judging && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-gray-700/50 bg-gray-900/80 overflow-hidden"
              >
                <div className="p-3 flex items-center gap-4">
                  <button
                    onClick={() => setShowResult(false)}
                    className="text-gray-500 hover:text-gray-300 text-xs ml-auto"
                  >
                    ✕
                  </button>
                  {submitResult.error ? (
                    <p className="text-red-400 text-sm">❌ {submitResult.error}</p>
                  ) : submitResult.hint ? (
                    <p className="text-yellow-400 text-sm">💡 {submitResult.hint}</p>
                  ) : (
                    <div className="flex items-center gap-4 text-sm">
                      <span className={submitResult.passedTests === submitResult.totalTests ? 'text-green-400' : 'text-red-400'}>
                        {submitResult.passedTests === submitResult.totalTests ? '✅' : '❌'} {submitResult.passedTests}/{submitResult.totalTests} tests
                      </span>
                      {submitResult.damage > 0 && (
                        <span className="text-orange-400">💥 {submitResult.damage} dmg dealt</span>
                      )}
                      {submitResult.avgRuntimeMs && (
                        <span className="text-gray-400">⏱ {submitResult.avgRuntimeMs}ms avg</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Spell effects overlay */}
      <AnimatePresence>
        {spellEffects.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center"
          >
            {spellEffects.map((effect) => (
              <motion.div
                key={effect.id}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="absolute text-8xl"
                style={{ textShadow: '0 0 30px rgba(168,85,247,0.8)' }}
              >
                {effect.spellType === 'time_freeze' ? '❄️' : effect.spellType === 'slow' ? '🐌' : '💡'}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default BattlePage
