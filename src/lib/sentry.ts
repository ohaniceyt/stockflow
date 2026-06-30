import type * as SentryReact from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

let Sentry: typeof SentryReact | null = null

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
