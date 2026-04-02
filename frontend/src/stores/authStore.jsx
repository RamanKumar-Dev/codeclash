import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      
      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const response = await fetch('http://localhost:3001/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          })
          const data = await response.json()
          
          if (response.ok) {
            set({ user: data.user, token: data.token, isLoading: false })
            return { success: true }
          } else {
            set({ isLoading: false })
            return { success: false, error: data.error }
          }
        } catch (error) {
          set({ isLoading: false })
          return { success: false, error: 'Network error' }
        }
      },
      
      register: async (username, email, password) => {
        set({ isLoading: true })
        try {
          const response = await fetch('http://localhost:3001/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
          })
          const data = await response.json()
          
          if (response.ok) {
            set({ user: data.user, token: data.token, isLoading: false })
            return { success: true }
          } else {
            set({ isLoading: false })
            return { success: false, error: data.error }
          }
        } catch (error) {
          set({ isLoading: false })
          return { success: false, error: 'Network error' }
        }
      },
      
      logout: () => {
        set({ user: null, token: null })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
