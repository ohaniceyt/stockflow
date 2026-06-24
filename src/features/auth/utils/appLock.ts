const APP_LOCK_HASH_KEY = 'stockflow-app-lock-hash'
const APP_LOCK_EMAIL_KEY = 'stockflow-app-lock-email'

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getStoredLockEmail(): string | null {
  try {
    return localStorage.getItem(APP_LOCK_EMAIL_KEY)
  } catch {
    return null
  }
}

export function setStoredLockEmail(email: string): void {
  try {
    localStorage.setItem(APP_LOCK_EMAIL_KEY, email.toLowerCase())
  } catch {
    // ignore
  }
}

export function clearStoredLockEmail(): void {
  try {
    localStorage.removeItem(APP_LOCK_EMAIL_KEY)
  } catch {
    // ignore
  }
}

export async function setAppLockPin(pin: string): Promise<void> {
  const hash = await sha256(pin)
  try {
    localStorage.setItem(APP_LOCK_HASH_KEY, hash)
  } catch {
    // ignore
  }
}

export async function verifyAppLockPin(pin: string): Promise<boolean> {
  const stored = getAppLockPinHash()
  if (!stored) return true
  const hash = await sha256(pin)
  return hash === stored
}

export function getAppLockPinHash(): string | null {
  try {
    return localStorage.getItem(APP_LOCK_HASH_KEY)
  } catch {
    return null
  }
}

export function clearAppLockPin(): void {
  try {
    localStorage.removeItem(APP_LOCK_HASH_KEY)
  } catch {
    // ignore
  }
}

export function hasAppLockPin(): boolean {
  return !!getAppLockPinHash()
}
