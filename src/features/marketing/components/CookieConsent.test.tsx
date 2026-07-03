import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CookieConsentBanner } from './CookieConsent'
import { saveConsent, loadConsent } from '../hooks/useCookieConsent'

const CONSENT_KEY = 'sf-cookie-consent'

function getStoredState(): string | null {
  const raw = localStorage.getItem(CONSENT_KEY)
  if (!raw) return null
  const parsed = JSON.parse(raw) as { state?: string }
  return parsed.state ?? null
}

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('shows banner when no consent is stored', () => {
    render(<CookieConsentBanner />)
    expect(screen.queryByRole('dialog', { name: /Consentement aux cookies/i })).not.toBeNull()
  })

  it('hides banner after accepting all cookies', () => {
    render(<CookieConsentBanner />)
    fireEvent.click(screen.getByRole('button', { name: /Tout accepter/i }))
    expect(screen.queryByRole('dialog', { name: /Consentement aux cookies/i })).toBeNull()
    expect(getStoredState()).toBe('all')
  })

  it('hides banner after rejecting optional cookies', () => {
    render(<CookieConsentBanner />)
    fireEvent.click(screen.getByRole('button', { name: /Refuser/i }))
    expect(screen.queryByRole('dialog', { name: /Consentement aux cookies/i })).toBeNull()
    expect(getStoredState()).toBe('necessary')
  })

  it('reads stored consent value', () => {
    saveConsent('all')
    expect(loadConsent()).toBe('all')
  })
})
