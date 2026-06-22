import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  setSession: (user: User, token: string) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: (user, token) => set({ user, accessToken: token }),
      clearSession: () => set({ user: null, accessToken: null }),
    }),
    {
      name: 'stockflow-auth',
    }
  )
)
