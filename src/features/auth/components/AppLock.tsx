import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Lock, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/context/AuthContext'
import { APP_LOCK_ENABLED, getStoredLockEmail } from '../utils/appLock'

export function AppLock() {
  const { isLocked, isAuthenticated, unlockApp, requestPinReset, signOut, session } = useAuth()
  const location = useLocation()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // AppLock is disabled globally.
  if (!APP_LOCK_ENABLED) return null

  // During a PIN reset the user must be able to reach the reset page without knowing the old PIN.
  // Back Office is a platform-admin context and should not be gated by the local AppLock.
  if (location.pathname === '/auth/reset-pin' || location.pathname.startsWith('/back-office'))
    return null
  if (!isAuthenticated || !isLocked) return null

  const email = session?.user.email ?? getStoredLockEmail() ?? ''

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      const ok = await unlockApp(pin)
      if (ok) {
        setPin('')
      } else {
        setError('PIN incorrect')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async () => {
    if (!email) {
      setError('Aucun email associé à cette session.')
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      await requestPinReset(email)
      setResetSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’envoi')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">StockFlow est verrouillé</h1>
          {email && <p className="mt-1 text-sm text-muted-foreground">{email}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            Ce code PIN est un verrouillage local de cet appareil. Il ne remplace pas votre mot de
            passe.
          </p>
        </div>

        {resetSent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Un lien de déverrouillage a été envoyé à votre adresse email. Cliquez sur le lien pour
              définir un nouveau PIN.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setResetSent(false)}>
              Retour
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Entrez votre PIN"
              className="text-center text-2xl tracking-widest"
              required
            />

            {error && <p className="text-center text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading || pin.length === 0}>
              {isLoading ? 'Vérification…' : 'Déverrouiller'}
            </Button>

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isLoading}
              >
                PIN oublié ?
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void signOut()}
                disabled={isLoading}
              >
                <LogOut className="mr-1 h-4 w-4" />
                Déconnexion
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
