const APP_LOCK_HASH_KEY = 'stockflow-app-lock-hash-v2'
const APP_LOCK_EMAIL_KEY = 'stockflow-app-lock-email'
const PBKDF2_ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BYTES = 32

interface StoredPin {
  salt: string
  hash: string
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function getCryptoSubtle(): SubtleCrypto {
  // Browsers always expose crypto.subtle. The check is defensive for non-browser environments.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is not available')
  }
  return crypto.subtle
}

async function derivePinHash(pin: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const subtle = getCryptoSubtle()
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  return subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_BYTES * 8
  )
}

function parseStoredPin(stored: string): StoredPin | null {
  try {
    const parsed = JSON.parse(stored) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      'salt' in parsed &&
      'hash' in parsed &&
      typeof parsed.salt === 'string' &&
      typeof parsed.hash === 'string'
    ) {
      return { salt: parsed.salt, hash: parsed.hash }
    }
    return null
  } catch {
    return null
  }
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
  getCryptoSubtle()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derivePinHash(pin, salt)
  const stored: StoredPin = {
    salt: arrayBufferToHex(salt.buffer),
    hash: arrayBufferToHex(hash),
  }
  try {
    localStorage.setItem(APP_LOCK_HASH_KEY, JSON.stringify(stored))
  } catch {
    // ignore
  }
}

export async function verifyAppLockPin(pin: string): Promise<boolean> {
  const storedRaw = getAppLockPinHash()
  if (!storedRaw) return true

  const stored = parseStoredPin(storedRaw)
  if (!stored) {
    // Legacy plain hash (sha256 hex) cannot be verified with PBKDF2.
    // Treat missing salt as invalid and clear the lock to force reset.
    clearAppLockPin()
    return false
  }

  const salt = hexToUint8Array(stored.salt)
  const hash = await derivePinHash(pin, salt)
  return arrayBufferToHex(hash) === stored.hash
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
