import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { supabase, supabaseKey } from '@/services/supabase'
import { edgeFetch } from '@/services/edgeFunctions'
import { pullSync } from '@/features/offline/services/syncService'
import type {
  Organization,
  OrganizationMembership,
  PlatformAdminRole,
  SudoTarget,
  User,
  UserRole,
} from '@/types'
import {
  clearAppLockPin,
  clearStoredLockEmail,
  hasAppLockPin,
  setAppLockPin,
  setStoredLockEmail,
  verifyAppLockPin,
} from '../utils/appLock'

interface AuthSession {
  user: User
  membership: OrganizationMembership
  organization: Organization
  accessToken: string
  refreshToken: string
  expiresAt: number
  isPlatformAdmin: boolean
  platformAdminRole: PlatformAdminRole | null
  onboardingCompleted: boolean
  needsOrganization: boolean
  sudoTarget?: SudoTarget | null
}

interface SignUpInput {
  name: string
  email: string
  password: string
  phone?: string
  plan?: 'free' | 'starter' | 'pro'
}

interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  isLoading: boolean
  isLocked: boolean
  signUp: (input: SignUpInput) => Promise<void>
  signIn: (email: string, password: string) => Promise<AuthSession>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  requestPinReset: (email: string) => Promise<void>
  setPin: (pin: string) => Promise<void>
  changePin: (currentPin: string, newPin: string) => Promise<void>
  unlockApp: (pin: string) => Promise<boolean>
  lockApp: () => void
  switchMembership: (membershipId: string) => Promise<void>
  hasRole: (roles: UserRole[]) => boolean
  isPlatformAdmin: boolean
  platformAdminRole: PlatformAdminRole | null
  sudoTarget: SudoTarget | null
  needsOrganization: boolean
  enterSudo: (target: SudoTarget) => Promise<void>
  exitSudo: () => Promise<void>
  completeOnboarding: (updates: {
    orgName: string
    orgSlug: string
    country: string
    currency: string
    timezone: string
    defaultLocationName: string
    plan?: 'free' | 'starter' | 'pro'
  }) => Promise<void>
  persistSession: (session: AuthSession | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_KEY = 'stockflow-session'
const SUDO_TARGET_KEY = 'stockflow-sudo-target'

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

function loadSudoTarget(): SudoTarget | null {
  try {
    const raw = localStorage.getItem(SUDO_TARGET_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SudoTarget
  } catch {
    return null
  }
}

async function runPullSync(orgId: string) {
  try {
    await pullSync(orgId)
  } catch (err) {
    console.error('Initial pull sync failed', err)
  }
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return fallback
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  ) {
    return String(value)
  }
  return fallback
}

interface RawInitializeResponse {
  user?: Record<string, unknown>
  membership?: Record<string, unknown>
  organization?: Record<string, unknown>
  isPlatformAdmin?: boolean
  platformAdminRole?: string
  onboardingCompleted?: boolean
  needsOrganization?: boolean
  error?: { message: string }
}

function buildSession(
  raw: RawInitializeResponse,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): AuthSession {
  const now = new Date().toISOString()
  const userRaw = raw.user ?? {}
  const membershipRaw = raw.membership ?? {}
  const organizationRaw = raw.organization ?? {}

  const user: User = {
    id: asString(userRaw.id),
    name: asString(userRaw.name),
    email: asString(userRaw.email),
    phone: userRaw.phone ? asString(userRaw.phone) : null,
    emailVerified: Boolean(userRaw.emailVerified),
    activeOrgId: typeof userRaw.activeOrgId === 'string' ? userRaw.activeOrgId : null,
    createdAt: typeof userRaw.createdAt === 'string' ? userRaw.createdAt : now,
    updatedAt: typeof userRaw.updatedAt === 'string' ? userRaw.updatedAt : now,
  }

  const membership: OrganizationMembership = raw.membership
    ? {
        id: asString(membershipRaw.id),
        orgId: asString(membershipRaw.orgId),
        userId: asString(membershipRaw.userId),
        role: asString(membershipRaw.role) as UserRole,
        hasPin: Boolean(membershipRaw.hasPin),
        isActive: Boolean(membershipRaw.isActive ?? true),
        forcePinChange: Boolean(membershipRaw.forcePinChange),
        lastLoginAt:
          typeof membershipRaw.lastLoginAt === 'string' ? membershipRaw.lastLoginAt : null,
        createdAt: typeof membershipRaw.createdAt === 'string' ? membershipRaw.createdAt : now,
        updatedAt: typeof membershipRaw.updatedAt === 'string' ? membershipRaw.updatedAt : now,
      }
    : {
        id: '',
        orgId: '',
        userId: asString(userRaw.id),
        role: 'super_admin',
        hasPin: false,
        isActive: true,
        forcePinChange: false,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      }

  const organization: Organization = raw.organization
    ? {
        id: asString(organizationRaw.id),
        name: asString(organizationRaw.name),
        slug: asString(organizationRaw.slug),
        country: typeof organizationRaw.country === 'string' ? organizationRaw.country : null,
        currency: asString(organizationRaw.currency),
        timezone: asString(organizationRaw.timezone),
        isActive: Boolean(organizationRaw.isActive ?? true),
        isSuspended: Boolean(organizationRaw.isSuspended),
        suspensionReason:
          typeof organizationRaw.suspensionReason === 'string'
            ? organizationRaw.suspensionReason
            : null,
        onboardingCompleted: Boolean(organizationRaw.onboardingCompleted),
        hasCashierEnabled: Boolean(organizationRaw.hasCashierEnabled),
        hasStorefrontEnabled: Boolean(organizationRaw.hasStorefrontEnabled),
        hasApiEnabled: Boolean(organizationRaw.hasApiEnabled),
        storefrontLocationId:
          typeof organizationRaw.storefrontLocationId === 'string'
            ? organizationRaw.storefrontLocationId
            : null,
        hasInvoicingEnabled: Boolean(organizationRaw.hasInvoicingEnabled),
        hasTaxEnabled: Boolean(organizationRaw.hasTaxEnabled),
        taxName: typeof organizationRaw.taxName === 'string' ? organizationRaw.taxName : null,
        taxRate: typeof organizationRaw.taxRate === 'number' ? organizationRaw.taxRate : null,
        taxId: typeof organizationRaw.taxId === 'string' ? organizationRaw.taxId : null,
        invoicePrefix:
          typeof organizationRaw.invoicePrefix === 'string' ? organizationRaw.invoicePrefix : null,
        quotePrefix:
          typeof organizationRaw.quotePrefix === 'string' ? organizationRaw.quotePrefix : null,
        deliveryNotePrefix:
          typeof organizationRaw.deliveryNotePrefix === 'string'
            ? organizationRaw.deliveryNotePrefix
            : null,
        receiptPrefix:
          typeof organizationRaw.receiptPrefix === 'string' ? organizationRaw.receiptPrefix : null,
        legalMentions:
          typeof organizationRaw.legalMentions === 'string' ? organizationRaw.legalMentions : null,
        autoReminderEnabled: Boolean(organizationRaw.autoReminderEnabled),
        autoReminderDays:
          typeof organizationRaw.autoReminderDays === 'number'
            ? organizationRaw.autoReminderDays
            : null,
        createdAt: typeof organizationRaw.createdAt === 'string' ? organizationRaw.createdAt : now,
        updatedAt: typeof organizationRaw.updatedAt === 'string' ? organizationRaw.updatedAt : now,
      }
    : {
        id: '',
        name: '',
        slug: '',
        country: null,
        currency: 'XOF',
        timezone: 'Africa/Abidjan',
        isActive: true,
        isSuspended: false,
        suspensionReason: null,
        onboardingCompleted: false,
        hasCashierEnabled: false,
        hasStorefrontEnabled: false,
        hasApiEnabled: false,
        storefrontLocationId: null,
        hasInvoicingEnabled: false,
        hasTaxEnabled: false,
        taxName: null,
        taxRate: null,
        taxId: null,
        invoicePrefix: null,
        quotePrefix: null,
        deliveryNotePrefix: null,
        receiptPrefix: null,
        legalMentions: null,
        autoReminderEnabled: false,
        autoReminderDays: null,
        createdAt: now,
        updatedAt: now,
      }

  const platformAdminRole: PlatformAdminRole | null =
    raw.platformAdminRole === 'super_admin' || raw.platformAdminRole === 'moderator'
      ? raw.platformAdminRole
      : null

  return {
    user,
    membership,
    organization,
    accessToken,
    refreshToken,
    expiresAt,
    isPlatformAdmin: Boolean(raw.isPlatformAdmin),
    platformAdminRole,
    onboardingCompleted: Boolean(raw.onboardingCompleted),
    needsOrganization: Boolean(raw.needsOrganization),
    sudoTarget: loadSudoTarget(),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(loadSession())
  const [isLoading, setIsLoading] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const lastInitializedToken = useRef<string | null>(null)

  const persistSession = useCallback((next: AuthSession | null) => {
    if (next) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
    setSession(next)
  }, [])

  const clearSession = useCallback(() => {
    persistSession(null)
    clearAppLockPin()
    clearStoredLockEmail()
    setIsLocked(false)
  }, [persistSession])

  const initializeSession = useCallback(
    async (supabaseSession: {
      access_token: string
      refresh_token: string
      expires_at?: number
      expires_in?: number
    }) => {
      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)

      const response = await fetch(`${supabaseUrl}/functions/v1/initialize-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseSession.access_token}`,
        },
      })

      const data = (await response.json()) as RawInitializeResponse
      if (!response.ok) {
        throw new Error(data.error?.message ?? 'Failed to initialize session')
      }

      const expiresAt =
        supabaseSession.expires_at ??
        (supabaseSession.expires_in
          ? Math.floor(Date.now() / 1000) + supabaseSession.expires_in
          : 0)

      const next = buildSession(
        data,
        supabaseSession.access_token,
        supabaseSession.refresh_token,
        expiresAt
      )

      // Guard against session races (e.g. email-verification page signs out while
      // this initialization is in flight). Only persist if Supabase still holds
      // the same session we just initialized for.
      const { data: currentSession } = await supabase.auth.getSession()
      if (currentSession.session?.access_token !== supabaseSession.access_token) {
        throw new Error('Session changed during initialization')
      }

      persistSession(next)
      lastInitializedToken.current = supabaseSession.access_token

      setStoredLockEmail(next.user.email)

      if (next.membership.forcePinChange) {
        // Admin forced a reset: clear local PIN and do not lock until the user sets a new one.
        clearAppLockPin()
        setIsLocked(false)
      } else {
        // Lock only if this device has previously stored a PIN.
        setIsLocked(hasAppLockPin())
      }

      if (next.organization.id && !next.needsOrganization) {
        void runPullSync(next.organization.id)
      }

      return next
    },
    [persistSession]
  )

  // Initialize from persisted Supabase session on mount
  useEffect(() => {
    let mounted = true

    void (async () => {
      const { data, error } = await supabase.auth.getSession()
      // mounted can be set to false by the cleanup if the component unmounts before this runs
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!mounted) return

      if (error) {
        console.error('getSession error', error)
        clearSession()
        return
      }

      if (data.session) {
        try {
          await initializeSession(data.session)
        } catch (err) {
          console.error('Initialize session failed', err)
          clearSession()
        }
      } else if (loadSession()) {
        // Stale custom session with no Supabase session: clear it.
        clearSession()
      }
    })()

    return () => {
      mounted = false
    }
  }, [initializeSession, clearSession])

  // Listen to auth state changes (verification links, magic links, password recovery)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (event === 'SIGNED_IN' && authSession) {
        if (lastInitializedToken.current !== authSession.access_token) {
          try {
            await initializeSession(authSession)
          } catch (err) {
            console.error('Auth state SIGNED_IN initialize failed', err)
            clearSession()
          }
        }
      } else if (event === 'TOKEN_REFRESHED' && authSession && session) {
        persistSession({
          ...session,
          accessToken: authSession.access_token,
          refreshToken: authSession.refresh_token,
          expiresAt:
            authSession.expires_at ??
            // expires_in can be omitted by Supabase types at build time but still be missing at runtime
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            Math.floor(Date.now() / 1000) + (authSession.expires_in ?? 3600),
        })
      } else if (event === 'SIGNED_OUT') {
        clearSession()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initializeSession, clearSession, session, persistSession])

  const signUp = useCallback(async ({ name, email, password, phone, plan }: SignUpInput) => {
    const data = await edgeFetch<{
      success?: boolean
      message?: string
      error?: { message: string } | string
    }>('signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone, plan }),
    })
    if (!data.success) {
      const serverError =
        data.message ?? (typeof data.error === 'string' ? data.error : data.error?.message)
      throw new Error(serverError ?? 'Signup failed')
    }
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        // Supabase types mark data.session as non-nullish, but it can be missing on error
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (error || !data.session) {
          throw new Error(error?.message ?? 'Sign in failed')
        }
        return await initializeSession(data.session)
      } finally {
        setIsLoading(false)
      }
    },
    [initializeSession]
  )

  const signOut = useCallback(async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      clearSession()
    } finally {
      setIsLoading(false)
    }
  }, [clearSession])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      throw new Error(error.message)
    }
  }, [])

  const requestPinReset = useCallback(async (email: string) => {
    // Use a server-side Edge Function so we can mark force_pin_change = true
    // before the magic link is consumed. Without this, users who already have a
    // PIN cannot set a new one because /change-pin requires the current PIN.
    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
    const response = await fetch(`${supabaseUrl}/functions/v1/request-pin-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: { message: string } | string
      }
      const message = typeof data.error === 'string' ? data.error : data.error?.message
      throw new Error(message ?? 'Échec de la demande de réinitialisation du PIN')
    }
  }, [])

  const setPin = useCallback(
    async (pin: string) => {
      if (!session) throw new Error('Not authenticated')
      if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4 to 8 digits')

      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
      const response = await fetch(`${supabaseUrl}/functions/v1/change-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({ newPin: pin }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: { message: string } }
        throw new Error(data.error?.message ?? 'Failed to set PIN')
      }

      await setAppLockPin(pin)
      persistSession({
        ...session,
        membership: {
          ...session.membership,
          hasPin: true,
          forcePinChange: false,
        },
      })
    },
    [session, persistSession]
  )

  const changePin = useCallback(
    async (currentPin: string, newPin: string) => {
      if (!session) throw new Error('Not authenticated')
      if (!/^\d{4,8}$/.test(newPin)) throw new Error('New PIN must be 4 to 8 digits')

      // A forced reset lets the user choose a new PIN without knowing the old one.
      if (!session.membership.forcePinChange) {
        const currentOk = await verifyAppLockPin(currentPin)
        if (!currentOk) {
          throw new Error('Current PIN is incorrect')
        }
      }

      // The AppLock PIN is local to this device. The server only validates format + auth.
      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
      const response = await fetch(`${supabaseUrl}/functions/v1/change-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({ newPin }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: { message: string } }
        throw new Error(data.error?.message ?? 'Failed to change PIN')
      }

      await setAppLockPin(newPin)
      persistSession({
        ...session,
        membership: {
          ...session.membership,
          hasPin: true,
          forcePinChange: false,
        },
      })
    },
    [session, persistSession]
  )

  const unlockApp = useCallback(async (pin: string) => {
    const ok = await verifyAppLockPin(pin)
    if (ok) {
      setIsLocked(false)
    }
    return ok
  }, [])

  const lockApp = useCallback(() => {
    if (hasAppLockPin()) {
      setIsLocked(true)
    }
  }, [])

  const enterSudo = useCallback(
    async (target: SudoTarget) => {
      if (!session) throw new Error('Not authenticated')
      if (!session.platformAdminRole) throw new Error('Not a platform admin')

      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
      const response = await fetch(`${supabaseUrl}/functions/v1/platform-impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({
          orgId: target.id,
          userId: target.targetUserId,
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Failed to enter sudo context')
      }

      const data = (await response.json()) as { sudoTarget?: SudoTarget }
      const sudoTarget = data.sudoTarget ?? target
      localStorage.setItem(SUDO_TARGET_KEY, JSON.stringify(sudoTarget))
      persistSession({ ...session, sudoTarget })
    },
    [session, persistSession]
  )

  const exitSudo = useCallback(async () => {
    if (!session) throw new Error('Not authenticated')

    const targetId = session.sudoTarget?.id
    if (targetId) {
      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
      try {
        await fetch(`${supabaseUrl}/functions/v1/platform-exit-impersonation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
            apikey: supabaseKey,
          },
          body: JSON.stringify({ targetId }),
        })
      } catch (err) {
        console.error('Failed to log sudo exit', err)
      }
    }

    localStorage.removeItem(SUDO_TARGET_KEY)
    persistSession({ ...session, sudoTarget: null })
  }, [session, persistSession])

  const switchMembership = useCallback(
    async (membershipId: string) => {
      if (!session) throw new Error('Not authenticated')

      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
      const response = await fetch(`${supabaseUrl}/functions/v1/switch-membership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({ membershipId }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: { message: string } }
        throw new Error(data.error?.message ?? 'Failed to switch organization')
      }

      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        throw new Error(error?.message ?? 'Session lost')
      }

      await initializeSession(data.session)
    },
    [session, initializeSession]
  )

  const completeOnboarding = useCallback(
    async (input: {
      orgName: string
      orgSlug: string
      country: string
      currency: string
      timezone: string
      defaultLocationName: string
      plan?: 'free' | 'starter' | 'pro'
    }) => {
      if (!session) throw new Error('Not authenticated')

      const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
      const response = await fetch(`${supabaseUrl}/functions/v1/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({
          orgName: input.orgName,
          orgSlug: input.orgSlug,
          country: input.country,
          currency: input.currency,
          timezone: input.timezone,
          defaultLocationName: input.defaultLocationName,
          plan: input.plan,
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string | { message: string; details?: unknown }
        }
        let message = 'Failed to complete onboarding'
        if (typeof data.error === 'string') {
          message = data.error
        } else if (data.error?.message) {
          message = `${data.error.message}${data.error.details ? ` — ${JSON.stringify(data.error.details)}` : ''}`
        }
        throw new Error(message)
      }

      // Re-initialize the session so the real membership and organization are loaded.
      const { data: supabaseSession, error } = await supabase.auth.getSession()
      if (error || !supabaseSession.session) {
        throw new Error(error?.message ?? 'Session lost')
      }
      await initializeSession(supabaseSession.session)
    },
    [session, initializeSession]
  )

  const hasRole = useCallback(
    (roles: UserRole[]) => {
      if (!session) return false
      return roles.includes(session.membership.role)
    },
    [session]
  )

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: !!session,
      isLoading,
      isLocked,
      signUp,
      signIn,
      signOut,
      resetPassword,
      requestPinReset,
      setPin,
      changePin,
      unlockApp,
      lockApp,
      switchMembership,
      hasRole,
      isPlatformAdmin: !!session?.isPlatformAdmin,
      platformAdminRole: session?.platformAdminRole ?? null,
      sudoTarget: session?.sudoTarget ?? null,
      needsOrganization: session?.needsOrganization ?? false,
      enterSudo,
      exitSudo,
      completeOnboarding,
      persistSession,
    }),
    [
      session,
      isLoading,
      isLocked,
      signUp,
      signIn,
      signOut,
      resetPassword,
      requestPinReset,
      setPin,
      changePin,
      unlockApp,
      lockApp,
      switchMembership,
      hasRole,
      enterSudo,
      exitSudo,
      completeOnboarding,
      persistSession,
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
