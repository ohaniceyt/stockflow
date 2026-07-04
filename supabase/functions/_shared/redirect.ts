/**
 * Shared redirect URL validation for magic links, email confirmations and
 * password recovery.
 *
 * Only exact, configured origins are allowed. Wildcards are rejected to prevent
 * open-redirect / token theft.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://localhost:5173',
]

function getAllowedOrigins(): string[] {
  const envOrigin = Deno.env.get('PUBLIC_APP_URL')
  const origins: string[] = envOrigin ? [envOrigin] : []
  return [...origins, ...DEFAULT_ALLOWED_ORIGINS]
}

export function getDefaultRedirectUrl(): string {
  return Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
}

export function isAllowedRedirectUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  // Reject non-HTTP(S) schemes completely.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }

  const allowed = getAllowedOrigins()
  return allowed.some((origin) => {
    let normalized = origin.trim()
    // Strip trailing "/**" or "/" that may come from config-style entries.
    if (normalized.endsWith('/**')) {
      normalized = normalized.slice(0, -3)
    }
    while (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }

    let allowedUrl: URL
    try {
      allowedUrl = new URL(normalized)
    } catch {
      return false
    }

    return parsed.origin === allowedUrl.origin
  })
}
