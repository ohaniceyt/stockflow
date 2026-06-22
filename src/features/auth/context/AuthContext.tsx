import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { User, UserRole } from '@/types'

interface AuthSession {
  user: User
  accessToken: string
  refreshToken: string
  expiresAt: number
  forcePinChange: boolean
}

interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  login: (userId: string, pin: string) => Promise<void>
  changePin: (currentPin: string, newPin: string) => Promise<void>
  logout: () => void
  hasRole: (roles: UserRole[]) => boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_KEY = 'stockflow-session'

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (parsed.expiresAt && parsed.expiresAt * 1000 < Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(loadSession())
  const [isLoading, setIsLoading] = useState(false)

  const persistSession = useCallback((next: AuthSession | null) => {
    if (next) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
    setSession(next)
  }, [])

  const login = useCallback(
    async (userId: string, pin: string) => {
      setIsLoading(true)
      try {
        const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
        const response = await fetch(`${supabaseUrl}/functions/v1/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
          },
          body: JSON.stringify({ userId, pin }),
        })

        const data = (await response.json()) as {
          access_token?: string
          refresh_token?: string
          expires_in?: number
          user?: User & { forcePinChange?: boolean }
          error?: { message: string }
        }

        if (!response.ok || !data.access_token || !data.user) {
          throw new Error(data.error?.message ?? 'Échec de la connexion')
        }

        const next: AuthSession = {
          user: {
            id: data.user.id,
            orgId: data.user.orgId,
            name: data.user.name,
            role: data.user.role,
            isActive: data.user.isActive,
            lastLoginAt: data.user.lastLoginAt,
            createdAt: data.user.createdAt,
            updatedAt: data.user.updatedAt,
          },
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? '',
          expiresAt: Date.now() / 1000 + (data.expires_in ?? 3600),
          forcePinChange: data.user.forcePinChange ?? false,
        }

        persistSession(next)
      } finally {
        setIsLoading(false)
      }
    },
    [persistSession]
  )

  const changePin = useCallback(
    async (currentPin: string, newPin: string) => {
      if (!session) throw new Error('Non authentifié')
      setIsLoading(true)
      try {
        const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
        const response = await fetch(`${supabaseUrl}/functions/v1/change-pin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
            apikey: String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
          },
          body: JSON.stringify({ currentPin, newPin }),
        })

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: { message: string } }
          throw new Error(data.error?.message ?? 'Échec du changement de PIN')
        }

        persistSession({ ...session, forcePinChange: false })
      } finally {
        setIsLoading(false)
      }
    },
    [session, persistSession]
  )

  const logout = useCallback(() => {
    persistSession(null)
  }, [persistSession])

  const hasRole = useCallback(
    (roles: UserRole[]) => {
      if (!session) return false
      return roles.includes(session.user.role)
    },
    [session]
  )

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: !!session,
      login,
      changePin,
      logout,
      hasRole,
      isLoading,
    }),
    [session, login, changePin, logout, hasRole, isLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
