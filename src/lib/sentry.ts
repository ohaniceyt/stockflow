import type * as SentryReact from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

let Sentry: typeof SentryReact | null = null

const SENSITIVE_KEYS = new Set([
  'password',
  'pin',
  'token',
  'accessToken',
  'access_token',
  'refresh_token',
  'apikey',
  'api_key',
  'authorization',
  'secret',
  'private_key',
  'email',
  'ip_address',
  'phone',
  'address',
])

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return (
    SENSITIVE_KEYS.has(lower) ||
    /\b(password|token|secret|key|pin|email|ip|phone|ssn|iban)\b/.test(lower)
  )
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (/^eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_.-]*$/.test(value)) {
      return '[JWT]'
    }
    if (/^https?:\/\/[^\s]+$/i.test(value) && value.length <= 256) {
      return value
    }
    if (value.length > 64) {
      return '[redacted]'
    }
    return '[redacted]'
  }
  if (Array.isArray(value)) {
    return value.map(redactValue)
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSensitiveKey(k) ? '[redacted]' : redactValue(v)
    }
    return out
  }
  return value
}

function beforeSend(event: SentryReact.ErrorEvent): SentryReact.ErrorEvent | null {
  if (event.user) {
    event.user = redactValue(event.user) as SentryReact.User
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = redactValue(event.breadcrumbs) as SentryReact.Breadcrumb[]
  }
  if (event.extra) {
    event.extra = redactValue(event.extra) as Record<string, unknown>
  }
  if (event.contexts) {
    event.contexts = redactValue(event.contexts) as Record<string, SentryReact.Context>
  }
  if (event.request) {
    event.request = redactValue(event.request) as NonNullable<SentryReact.Event['request']>
  }
  return event
}

async function loadSentry(): Promise<typeof SentryReact | null> {
  if (!dsn) return null
  if (Sentry) return Sentry
  try {
    Sentry = await import('@sentry/react')
    return Sentry
  } catch {
    return null
  }
}

export async function initSentry(): Promise<void> {
  const sdk = await loadSentry()
  if (!sdk) return
  sdk.init({
    dsn,
    integrations: [sdk.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend,
  })
}

export async function captureException(err: unknown): Promise<void> {
  const sdk = await loadSentry()
  if (!sdk) return
  sdk.captureException(err)
}

export async function captureMessage(msg: string): Promise<void> {
  const sdk = await loadSentry()
  if (!sdk) return
  sdk.captureMessage(msg)
}
