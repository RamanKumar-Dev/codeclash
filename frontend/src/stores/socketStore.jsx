import { create } from 'zustand'
import { io } from 'socket.io-client'

const SERVER_URL = 'http://localhost:3001'

export const useSocketStore = create((set, get) => ({
  socket: null,
  connected: false,
  authenticated: false,
  
  // Queue state
  inQueue: false,
  queuePosition: null,
  queueWaitSeconds: 0,

  // Battle state
  battle: null, // { roomId, puzzle, myHp, opponentHp, opponentName, opponentElo, timeLimitSeconds }
  battleStatus: 'idle', // 'idle' | 'countdown' | 'active' | 'ended'
  countdownSeconds: null,
  hp: { my: 500, opponent: 500 },
  lastDamageEvent: null,
  battleResult: null, // { winnerId, winnerName, winnerEloChange, loserEloChange, newAchievements }
  submitResult: null,
  spellEffects: [], // active spell effects on me

  connect: (token) => {
    const existing = get().socket
    if (existing) existing.disconnect()

    const socket = io(SERVER_URL, { transports: ['websocket'] })

    socket.on('connect', () => {
      set({ connected: true })
      socket.emit('authenticate', { token })
    })

    socket.on('authenticated', () => {
      set({ authenticated: true })
    })

    socket.on('auth:error', () => {
      set({ authenticated: false })
    })

    socket.on('disconnect', () => {
      set({ connected: false, authenticated: false, inQueue: false })
    })

    // Queue events
    socket.on('queue:joined', () => set({ inQueue: true, queueWaitSeconds: 0 }))
    socket.on('queue:position', (data) =>
      set({ queuePosition: data, queueWaitSeconds: data.waitSeconds })
    )
    socket.on('queue:error', (msg) => console.error('[Queue]', msg))

    // Match found
    socket.on('match:found', (data) => {
      set({
        inQueue: false,
        battle: data,
        battleStatus: 'countdown',
        hp: { my: data.myHp, opponent: data.opponentHp },
      })
    })

    // Countdown
    socket.on('battle:countdown', (data) => {
      set({ countdownSeconds: data.secondsLeft, battleStatus: 'countdown' })
    })

    // Battle start
    socket.on('battle:start', (data) => {
      set({ battleStatus: 'active', countdownSeconds: null })
      if (data?.puzzle) {
        set((s) => ({ battle: { ...s.battle, puzzle: data.puzzle } }))
      }
    })

    // Damage events
    socket.on('battle:damage', (data) => {
      set({ hp: { my: data.hp1, opponent: data.hp2 }, lastDamageEvent: data })
    })
    socket.on('battle:no_damage', (data) => set({ lastDamageEvent: { ...data, damage: 0 } }))

    // Submit result
    socket.on('submit:result', (data) => set({ submitResult: data }))
    socket.on('submit:error', (msg) => set({ submitResult: { error: msg } }))
    socket.on('submit:judging', () => set({ submitResult: { judging: true } }))

    // Battle end
    socket.on('battle:end', (data) => {
      set({ battleStatus: 'ended', battleResult: data })
    })
    socket.on('battle:timeout', (data) => {
      set({ battleStatus: 'ended', battleResult: { ...data, timeout: true } })
    })

    // Spell events
    socket.on('spell:incoming', (data) => {
      const effect = { ...data, id: Date.now() }
      set((s) => ({ spellEffects: [...s.spellEffects, effect] }))
      setTimeout(() => {
        set((s) => ({ spellEffects: s.spellEffects.filter((e) => e.id !== effect.id) }))
      }, data.duration || 3000)
    })
    socket.on('spell:hint', (data) => {
      set({ submitResult: { hint: data.text } })
    })
    socket.on('spell:cast_success', (data) => {
      console.log('[Spell] Cast success:', data)
    })
    socket.on('spell:error', (msg) => console.error('[Spell]', msg))
    socket.on('battle:time_warning', (data) => {
      console.log('[Battle] Time warning:', data.secondsLeft, 's left')
    })

    set({ socket })
  },

  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, connected: false, authenticated: false })
    }
  },

  joinQueue: () => {
    const { socket } = get()
    if (socket) socket.emit('queue:join')
  },

  leaveQueue: () => {
    const { socket } = get()
    if (socket) {
      socket.emit('queue:leave')
      set({ inQueue: false, queuePosition: null })
    }
  },

  submitCode: (roomId, code, languageId) => {
    const { socket } = get()
    if (socket) {
      set({ submitResult: { judging: true } })
      socket.emit('battle:submit', { roomId, code, languageId })
    }
  },

  castSpell: (roomId, spellType) => {
    const { socket } = get()
    if (socket) socket.emit('spell:cast', { roomId, spellType })
  },

  forfeit: (roomId) => {
    const { socket } = get()
    if (socket) socket.emit('battle:forfeit', { roomId })
  },

  resetBattle: () => {
    set({
      battle: null,
      battleStatus: 'idle',
      countdownSeconds: null,
      hp: { my: 500, opponent: 500 },
      lastDamageEvent: null,
      battleResult: null,
      submitResult: null,
      spellEffects: [],
    })
  },

  clearSubmitResult: () => set({ submitResult: null }),
}))
