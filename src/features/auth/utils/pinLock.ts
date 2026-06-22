const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000
const STORAGE_KEY = 'stockflow-pin-lockout'

interface LockoutEntry {
  attempts: number
  lockedUntil: number | null
}

function getKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`
}

function loadEntry(userId: string): LockoutEntry {
  try {
    const raw = localStorage.getItem(getKey(userId))
    if (!raw) return { attempts: 0, lockedUntil: null }
    return JSON.parse(raw) as LockoutEntry
  } catch {
    return { attempts: 0, lockedUntil: null }
  }
}

function saveEntry(userId: string, entry: LockoutEntry): void {
  localStorage.setItem(getKey(userId), JSON.stringify(entry))
}

export function getPinLockStatus(userId: string): {
  locked: boolean
  remainingMs: number
  attempts: number
} {
  const now = Date.now()
  const entry = loadEntry(userId)
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { locked: true, remainingMs: entry.lockedUntil - now, attempts: entry.attempts }
  }
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    saveEntry(userId, { attempts: 0, lockedUntil: null })
    return { locked: false, remainingMs: 0, attempts: 0 }
  }
  return { locked: false, remainingMs: 0, attempts: entry.attempts }
}

export function recordPinFailure(userId: string): {
  locked: boolean
  remainingMs: number
  attempts: number
} {
  const entry = loadEntry(userId)
  const attempts = entry.attempts + 1
  const locked = attempts >= MAX_ATTEMPTS
  const lockedUntil = locked ? Date.now() + LOCKOUT_MS : entry.lockedUntil
  saveEntry(userId, { attempts, lockedUntil })
  return {
    locked,
    remainingMs: locked ? LOCKOUT_MS : 0,
    attempts,
  }
}

export function resetPinLockout(userId: string): void {
  localStorage.removeItem(getKey(userId))
}

export function formatLockoutDuration(ms: number): string {
  const minutes = Math.ceil(ms / 60_000)
  return `${String(minutes)} min`
}
