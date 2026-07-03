import { useSyncExternalStore } from 'react'

const CONSENT_KEY = 'sf-cookie-consent'

export type ConsentState = 'pending' | 'necessary' | 'all'

interface StoredConsent {
  state: Exclude<ConsentState, 'pending'>
  updatedAt: string
}

export function loadConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return 'pending'
    const parsed = JSON.parse(raw) as Partial<StoredConsent>
    return parsed.state ?? 'pending'
  } catch {
    return 'pending'
  }
}

export function saveConsent(state: Exclude<ConsentState, 'pending'>): void {
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ state, updatedAt: new Date().toISOString() } satisfies StoredConsent)
    )
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('sf-cookie-consent-change'))
}

function getServerSnapshot(): ConsentState {
  return 'pending'
}

function subscribe(onStoreChange: () => void): () => void {
  const storageHandler = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY) {
      onStoreChange()
    }
  }
  const localHandler = () => onStoreChange()
  window.addEventListener('storage', storageHandler)
  window.addEventListener('sf-cookie-consent-change', localHandler)
  return () => {
    window.removeEventListener('storage', storageHandler)
    window.removeEventListener('sf-cookie-consent-change', localHandler)
  }
}

export function useCookieConsent(): ConsentState {
  return useSyncExternalStore(subscribe, loadConsent, getServerSnapshot)
}
