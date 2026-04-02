import { create } from 'zustand'
import { BattleStateData, BattleParticipant, DamageLog } from '@code-clash/shared-types'

interface BattleState {
  // Battle metadata
  roomId: string | null
  state: 'WAITING' | 'COUNTDOWN' | 'ACTIVE' | 'JUDGING' | 'ENDED'
  timeRemaining: number
  currentRound: number
  
  // Participants
  player1: BattleParticipant | null
  player2: BattleParticipant | null
  currentUserId: string | null
  
  // Puzzle
  puzzle: any | null
  
  // Combat logs
  damageLog: DamageLog[]
  
  // UI state
  isMyTurn: boolean
  opponentProgress: {
    linesChanged: number
    submissionCount: number
  }
  
  // Actions
  setBattleState: (battleData: BattleStateData) => void
  updateHealth: (userId: string, newHp: number) => void
  addDamageLog: (log: DamageLog) => void
  updateOpponentProgress: (progress: { linesChanged: number; submissionCount: number }) => void
  setTimeRemaining: (time: number) => void
  resetBattle: () => void
  setCurrentUserId: (userId: string) => void
}

export const useBattleStore = create<BattleState>((set, get) => ({
  roomId: null,
  state: 'WAITING',
  timeRemaining: 300,
  currentRound: 1,
  player1: null,
  player2: null,
  currentUserId: null,
  puzzle: null,
  damageLog: [],
  isMyTurn: false,
  opponentProgress: {
    linesChanged: 0,
    submissionCount: 0
  },

  setBattleState: (battleData: BattleStateData) => {
    const { currentUserId } = get()
    const isPlayer1 = battleData.player1.userId === currentUserId
    const isMyTurn = battleData.currentTurn === currentUserId

    set({
      roomId: battleData.room.id,
      state: battleData.room.state,
      timeRemaining: battleData.timeRemaining,
      currentRound: battleData.room.currentRound,
      player1: battleData.player1,
      player2: battleData.player2,
      puzzle: battleData.puzzle,
      isMyTurn,
      damageLog: []
    })
  },

  updateHealth: (userId: string, newHp: number) => {
    const { player1, player2 } = get()
    
    if (player1 && player1.userId === userId) {
      set({ player1: { ...player1, hp: newHp } })
    } else if (player2 && player2.userId === userId) {
      set({ player2: { ...player2, hp: newHp } })
    }
  },

  addDamageLog: (log: DamageLog) => {
    set((state) => ({
      damageLog: [...state.damageLog, log]
    }))
  },

  updateOpponentProgress: (progress: { linesChanged: number; submissionCount: number }) => {
    set({ opponentProgress: progress })
  },

  setTimeRemaining: (time: number) => {
    set({ timeRemaining: time })
  },

  resetBattle: () => {
    set({
      roomId: null,
      state: 'WAITING',
      timeRemaining: 300,
      currentRound: 1,
      player1: null,
      player2: null,
      puzzle: null,
      damageLog: [],
      isMyTurn: false,
      opponentProgress: {
        linesChanged: 0,
        submissionCount: 0
      }
    })
  },

  setCurrentUserId: (userId: string) => {
    set({ currentUserId: userId })
  }
}))
