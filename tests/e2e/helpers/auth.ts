import type { Page } from '@playwright/test'

export interface MockSession {
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    emailVerified: boolean
    activeOrgId: string
    createdAt: string
    updatedAt: string
  }
  membership: {
    id: string
    orgId: string
    userId: string
    role: 'super_admin' | 'admin' | 'operator' | 'reader'
    hasPin: boolean
    pinHash?: string | null
    isActive: boolean
    forcePinChange: boolean
    lastLoginAt: string | null
    createdAt: string
    updatedAt: string
  }
  organization: {
    id: string
    name: string
    currency: string
    timezone: string
    isActive: boolean
    isSuspended: boolean
    suspensionReason: string | null
    onboardingCompleted: boolean
    hasCashierEnabled: boolean
    hasStorefrontEnabled: boolean
    hasApiEnabled: boolean
    storefrontLocationId: string | null
    hasTaxEnabled: boolean
    taxName: string | null
    taxRate: number | null
    taxId: string | null
    receiptPrefix: string | null
    legalMentions: string | null
    createdAt: string
    updatedAt: string
  }
}

export const DEFAULT_MOCK_SESSION: MockSession = {
  user: {
    id: 'e2e-user-id',
    name: 'E2E Admin',
    email: 'e2e@example.com',
    phone: null,
    emailVerified: true,
    activeOrgId: 'e2e-org-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  membership: {
    id: 'e2e-membership-id',
    orgId: 'e2e-org-id',
    userId: 'e2e-user-id',
    role: 'super_admin',
    hasPin: true,
    isActive: true,
    forcePinChange: false,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  organization: {
    id: 'e2e-org-id',
    name: 'E2E Org',
    currency: 'XOF',
    timezone: 'Africa/Abidjan',
    isActive: true,
    isSuspended: false,
    suspensionReason: null,
    onboardingCompleted: true,
    hasCashierEnabled: true,
    hasStorefrontEnabled: false,
    hasApiEnabled: true,
    storefrontLocationId: null,
    hasTaxEnabled: false,
    taxName: null,
    taxRate: null,
    taxId: null,
    receiptPrefix: 'REC',
    legalMentions: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
}

export async function injectMockSession(page: Page, session: MockSession = DEFAULT_MOCK_SESSION) {
  await page.addInitScript((payload) => {
    const APP_SESSION_KEY = 'stockflow-session'
    const SUPABASE_SESSION_KEY = 'sf-auth-session'
    const accessToken = 'e2e-access-token'
    const refreshToken = 'e2e-refresh-token'
    const expiresAt = Math.floor(Date.now() / 1000) + 3600

    const stockflowSession = JSON.stringify({
      ...payload,
      accessToken,
      refreshToken,
      expiresAt,
      isPlatformAdmin: false,
      platformAdminRole: null,
      onboardingCompleted: true,
      sudoTarget: null,
    })

    const supabaseSession = JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      expires_at: expiresAt,
      token_type: 'bearer',
      user: {
        id: payload.user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: payload.user.email,
        email_confirmed_at: new Date().toISOString(),
        phone: payload.user.phone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })

    // The app stores its enriched session in localStorage and the Supabase session in sessionStorage.
    window.localStorage.setItem(APP_SESSION_KEY, stockflowSession)
    window.sessionStorage.setItem(SUPABASE_SESSION_KEY, supabaseSession)

    // Also intercept storage reads so any other key conventions still resolve.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalGetItem = Storage.prototype.getItem
    Storage.prototype.getItem = function (key: string) {
      if (key === APP_SESSION_KEY) return stockflowSession
      if (
        key === SUPABASE_SESSION_KEY ||
        key.endsWith('-auth-token') ||
        key === 'supabase.auth.token'
      ) {
        return supabaseSession
      }
      return originalGetItem.call(this, key)
    }
  }, session)
}

export async function clearMockSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem('stockflow-session')
    window.sessionStorage.removeItem('sf-auth-session')
  })
}
