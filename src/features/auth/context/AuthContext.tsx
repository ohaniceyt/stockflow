import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react'
import { supabase, supabaseKey } from '@/services/supabase'
import type { User, UserRole } from '@/types'

interface AuthSession {
  user: User
  accessToken: string
  refreshToken: string
  expiresAt: number
  forcePinChange: boolean
  onboardingCompleted: boolean
}

interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  login: (
    userId: string,
    pin: string
  ) => Promise<{ email: string; forcePinChange: boolean; onboardingCompleted: boolean }>
  verifyMagicLinkSession: () => Promise<void>
  changePin: (currentPin: string, newPin: string) => Promise<void>
  logout: () => void
  hasRole: (roles: UserRole[]) => boolean
  isLoading: boolean
  completeOnboarding: (updates: {
    orgName: string
    currency: string
    timezone: string
    defaultLocationName: string
  }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_KEY = 'stockflow-session'
const PENDING_EMAIL_KEY = 'stockflow-pending-email'
const PENDING_USER_KEY = 'stockflow-pending-user'

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

function loadPendingUser():
  | (User & { forcePinChange: boolean; onboardingCompleted: boolean })
  | null {
  try {
    const raw = localStorage.getItem(PENDING_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User & { forcePinChange: boolean; onboardingCompleted: boolean }
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

  const clearPending = useCallback(() => {
    localStorage.removeItem(PENDING_EMAIL_KEY)
    localStorage.removeItem(PENDING_USER_KEY)
  }, [])

  // Listen to magic link / OAuth callbacks
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (event === 'SIGNED_IN' && authSession) {
        const pendingUser = loadPendingUser()
        if (!pendingUser) return

        // Verify email matches pending user
        if (authSession.user.email?.toLowerCase() !== pendingUser.email.toLowerCase()) {
          await supabase.auth.signOut()
          clearPending()
          return
        }

        const next: AuthSession = {
          user: pendingUser,
          accessToken: authSession.access_token,
          refreshToken: authSession.refresh_token,
          expiresAt: Date.now() / 1000 + authSession.expires_in,
          forcePinChange: pendingUser.forcePinChange,
          onboardingCompleted: pendingUser.onboardingCompleted,
        }
        persistSession(next)
        clearPending()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [clearPending, persistSession])

  const login = useCallback(
    async (
      userId: string,
      pin: string
    ): Promise<{ email: string; forcePinChange: boolean; onboardingCompleted: boolean }> => {
      setIsLoading(true)
      try {
        const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
        const response = await fetch(`${supabaseUrl}/functions/v1/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ userId, pin }),
        })

        const data = (await response.json()) as {
          email?: string
          forcePinChange?: boolean
          onboardingCompleted?: boolean
          session?: {
            access_token: string
            refresh_token: string
            expires_in: number
            expires_at?: number
          }
          user?: User & { forcePinChange?: boolean; onboardingCompleted?: boolean }
          error?: { message: string }
        }

        if (!response.ok || !data.email || !data.user) {
          throw new Error(data.error?.message ?? 'Échec de la connexion')
        }

        const pendingUser: User & { forcePinChange: boolean; onboardingCompleted: boolean } = {
          ...data.user,
          forcePinChange: data.forcePinChange ?? false,
          onboardingCompleted: data.onboardingCompleted ?? true,
        }

        // Dev-only bypass: the Edge Function returned a session directly.
        if (data.session) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          })

          if (setSessionError) {
            throw new Error(setSessionError.message)
          }

          const next: AuthSession = {
            user: pendingUser,
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at ?? Date.now() / 1000 + data.session.expires_in,
            forcePinChange: pendingUser.forcePinChange,
            onboardingCompleted: pendingUser.onboardingCompleted,
          }
          persistSession(next)

          return {
            email: data.email,
            forcePinChange: data.forcePinChange ?? false,
            onboardingCompleted: data.onboardingCompleted ?? true,
          }
        }

        localStorage.setItem(PENDING_EMAIL_KEY, data.email)
        localStorage.setItem(PENDING_USER_KEY, JSON.stringify(pendingUser))

        // Send magic link via Resend-backed Edge Function instead of Supabase's default OTP email.
        const magicLinkResponse = await fetch(`${supabaseUrl}/functions/v1/send-magic-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            email: data.email,
            redirectTo: window.location.origin,
          }),
        })

        if (!magicLinkResponse.ok) {
          const magicLinkData = (await magicLinkResponse.json().catch(() => ({}))) as {
            error?: { message: string }
          }
          clearPending()
          throw new Error(magicLinkData.error?.message ?? "Échec de l'envoi du lien magique")
        }

        return {
          email: data.email,
          forcePinChange: data.forcePinChange ?? false,
          onboardingCompleted: data.onboardingCompleted ?? true,
        }
      } finally {
        setIsLoading(false)
      }
    },
    [clearPending, persistSession]
  )

  const verifyMagicLinkSession = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        throw new Error('Aucune session active')
      }

      const pendingUser = loadPendingUser()
      if (!pendingUser) {
        throw new Error('Aucune connexion en attente')
      }

      if (data.session.user.email?.toLowerCase() !== pendingUser.email.toLowerCase()) {
        await supabase.auth.signOut()
        clearPending()
        throw new Error("L'email ne correspond pas")
      }

      const next: AuthSession = {
        user: pendingUser,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: Date.now() / 1000 + data.session.expires_in,
        forcePinChange: pendingUser.forcePinChange,
        onboardingCompleted: pendingUser.onboardingCompleted,
      }
      persistSession(next)
      clearPending()
    } finally {
      setIsLoading(false)
    }
  }, [clearPending, persistSession])

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
            apikey: supabaseKey,
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

  const completeOnboarding = useCallback(
    async (input: {
      orgName: string
      currency: string
      timezone: string
      defaultLocationName: string
    }) => {
      if (!session) throw new Error('Non authentifié')

      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
      const response = await fetch(`${supabaseUrl}/functions/v1/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: { message: string } }
        throw new Error(data.error?.message ?? 'Échec de la finalisation')
      }

      persistSession({ ...session, onboardingCompleted: true })
    },
    [session, persistSession]
  )

  const logout = useCallback(() => {
    void supabase.auth.signOut()
    persistSession(null)
    clearPending()
  }, [clearPending, persistSession])

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
      verifyMagicLinkSession,
      changePin,
      logout,
      hasRole,
      isLoading,
      completeOnboarding,
    }),
    [
      session,
      login,
      verifyMagicLinkSession,
      changePin,
      logout,
      hasRole,
      isLoading,
      completeOnboarding,
    ]
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
