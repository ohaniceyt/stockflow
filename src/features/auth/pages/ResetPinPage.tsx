import { useEffect, useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/features/auth/context/AuthContext'

export default function ResetPinPage() {
  const navigate = useNavigate()
  const { setPin, isAuthenticated } = useAuth()
  const [ready, setReady] = useState(false)
  const [pin, setPinValue] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Wait for the magic-link OTP to be processed by the Supabase client.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setReady(true)
      }
    })()

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // If the user is not authenticated after verification, send them back to login.
    if (ready && !isAuthenticated) {
      void navigate('/login', { replace: true })
    }
  }, [ready, isAuthenticated, navigate])

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!/^\d{4,8}$/.test(pin)) {
      setError('Le PIN doit contenir entre 4 et 8 chiffres.')
      return
    }
    if (pin !== confirmPin) {
      setError('Les PIN ne correspondent pas.')
      return
    }

    setIsLoading(true)
    try {
      await setPin(pin)
      void navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du PIN')
    } finally {
      setIsLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl text-center">
          <p className="text-muted-foreground">Vérification de votre identité…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Choisissez un nouveau PIN</h1>
          <p className="text-sm text-muted-foreground">
            Votre identité a été confirmée. Définissez maintenant un nouveau code PIN.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce PIN est un verrouillage local de cet appareil. Il n’est pas synchronisé et ne
            remplace pas votre mot de passe StockFlow.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">Nouveau PIN (4 à 8 chiffres)</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-pin">Confirmez le PIN</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Enregistrement…' : 'Enregistrer le nouveau PIN'}
          </Button>
        </form>
      </div>
    </div>
  )
}
