import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../context/AuthContext'
import { PinPad } from '../components/PinPad'
import {
  formatLockoutDuration,
  getPinLockStatus,
  recordPinFailure,
  resetPinLockout,
} from '../utils/pinLock'
import { supabaseKey as SUPABASE_KEY } from '@/services/supabase'
import type { User } from '@/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

const PENDING_EMAIL_KEY = 'stockflow-pending-email'

function hasMagicLinkHash() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  return hash.includes('access_token=') && hash.includes('type=magiclink')
}

function loadPendingEmail(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(PENDING_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

interface LookupResult {
  found: boolean
  userId?: string
  name?: string
  role?: string
  orgId?: string
}

async function lookupUserByEmail(email: string): Promise<LookupResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/lookup-user-by-email`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  const data = (await res.json()) as LookupResult & { error?: { message: string } }
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Lookup failed')
  }
  return data
}

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'pin'>('email')
  const [email, setEmail] = useState(loadPendingEmail)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<Pick<
    User,
    'id' | 'name' | 'role' | 'orgId'
  > | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(hasMagicLinkHash)
  const [isVerifyingMagicLink, setIsVerifyingMagicLink] = useState(hasMagicLinkHash)
  const [lockTick, setLockTick] = useState(0)
  const verificationCancelled = useRef(false)
  const { login, isAuthenticated, isLoading, verifyMagicLinkSession } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      void navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Automatic magic-link verification: when the user lands here after clicking
  // the magic link, the URL hash contains the Supabase auth tokens. We verify
  // the session immediately so the user does not have to click "Continue" or
  // re-enter their email.
  useEffect(() => {
    if (!isVerifyingMagicLink) return

    verificationCancelled.current = false
    void (async () => {
      try {
        await verifyMagicLinkSession()
        // AuthContext will set isAuthenticated; the effect above redirects.
      } catch (err) {
        if (verificationCancelled.current) return
        setError(err instanceof Error ? err.message : 'Session invalide')
      } finally {
        if (!verificationCancelled.current) setIsVerifyingMagicLink(false)
      }
    })()

    return () => {
      verificationCancelled.current = true
    }
  }, [isVerifyingMagicLink, verifyMagicLinkSession])

  const pinLock = selectedUser ? getPinLockStatus(selectedUser.id) : null

  useEffect(() => {
    if (!selectedUser || !pinLock?.locked) return
    const timer = setInterval(() => setLockTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [selectedUser, pinLock?.locked])

  const handleEmailSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLookupError(null)
    try {
      const result = await lookupUserByEmail(email)
      if (!result.found || !result.userId || !result.name || !result.orgId) {
        setLookupError('Aucun compte actif trouvé pour cet email.')
        return
      }
      setSelectedUser({
        id: result.userId,
        name: result.name,
        role: result.role as User['role'],
        orgId: result.orgId,
      })
      setStep('pin')
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Erreur de recherche')
    }
  }

  const handlePinSubmit = async (pin: string) => {
    if (!selectedUser) return
    setError(null)

    const lock = getPinLockStatus(selectedUser.id)
    if (lock.locked) {
      setLockTick((t) => t + 1)
      return
    }

    try {
      const result = await login(selectedUser.id, pin)
      resetPinLockout(selectedUser.id)
      setMagicLinkSent(true)
      setEmail(result.email)
    } catch (err) {
      recordPinFailure(selectedUser.id)
      setLockTick((t) => t + 1)
      setError(err instanceof Error ? err.message : 'PIN incorrect')
    }
  }

  const handleVerify = async () => {
    setError(null)
    setIsVerifyingMagicLink(true)
    try {
      await verifyMagicLinkSession()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session invalide')
    } finally {
      setIsVerifyingMagicLink(false)
    }
  }

  const maskEmail = (value: string) => {
    const [local, domain] = value.split('@')
    if (!local || !domain) return value
    const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : '***'
    return `${maskedLocal}@${domain}`
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-3xl font-bold text-primary-foreground">
            S
          </div>
          <h1 className="text-2xl font-bold">StockFlow vNext</h1>
          <p className="text-sm text-muted-foreground">Connectez-vous à votre organisation</p>
        </div>

        {magicLinkSent ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-primary/10 p-6">
              <h3 className="mb-2 text-lg font-semibold text-primary">
                {isVerifyingMagicLink ? 'Connexion en cours…' : 'Vérifiez votre email'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Un lien de connexion sécurisé a été envoyé à{' '}
                <span className="font-medium text-foreground">{maskEmail(email)}</span>.
              </p>
              {!isVerifyingMagicLink && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Cliquez sur le lien dans l’email, puis revenez ici et cliquez sur "Continuer".
                </p>
              )}
            </div>
            {!isVerifyingMagicLink && (
              <button
                type="button"
                onClick={() => {
                  setMagicLinkSent(false)
                  setEmail('')
                  setSelectedUser(null)
                  setStep('email')
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Changer de compte
              </button>
            )}
            <button
              type="button"
              onClick={handleVerify}
              disabled={isLoading || isVerifyingMagicLink}
              className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading || isVerifyingMagicLink ? 'Vérification…' : 'Continuer'}
            </button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
              />
            </div>
            {lookupError && <p className="text-sm text-destructive">{lookupError}</p>}
            <Button type="submit" className="w-full">
              Continuer
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Pas encore de compte ?{' '}
              <a href="/signup" className="text-primary hover:underline">
                Créer un compte
              </a>
            </p>
          </form>
        ) : (
          <div className="space-y-4" key={lockTick}>
            <button
              type="button"
              onClick={() => {
                setSelectedUser(null)
                setError(null)
                setStep('email')
                setLockTick((t) => t + 1)
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Utiliser un autre email
            </button>
            {pinLock?.locked && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
                Trop de tentatives échouées. Réessayez dans{' '}
                <strong>{formatLockoutDuration(pinLock.remainingMs)}</strong>.
              </div>
            )}
            <PinPad
              title={`Bonjour, ${selectedUser?.name.split(' ')[0] ?? ''}`}
              onSubmit={handlePinSubmit}
              onCancel={() => {
                setSelectedUser(null)
                setError(null)
                setStep('email')
                setLockTick((t) => t + 1)
              }}
              error={error}
              disabled={isLoading || (pinLock?.locked ?? false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
