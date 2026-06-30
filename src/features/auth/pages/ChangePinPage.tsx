import { useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/context/AuthContext'
import { StatusBadge } from '@/components/design-system'

export default function ChangePinPage() {
  const { changePin, session } = useAuth()
  const navigate = useNavigate()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isForcedReset = session?.membership.forcePinChange ?? false

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!/^\d{4,8}$/.test(newPin)) {
      setError('Le nouveau PIN doit contenir entre 4 et 8 chiffres.')
      return
    }
    if (newPin !== confirmPin) {
      setError('Les nouveaux PIN ne correspondent pas.')
      return
    }

    setIsLoading(true)
    try {
      await changePin(currentPin, newPin)
      void navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de PIN')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">
            {isForcedReset ? 'Réinitialisation du PIN' : 'Changer mon PIN'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isForcedReset
              ? 'Un administrateur a demandé la réinitialisation de votre PIN. Choisissez-en un nouveau.'
              : 'Saisissez votre PIN actuel puis choisissez-en un nouveau.'}
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <StatusBadge variant="danger">{error}</StatusBadge>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isForcedReset && (
            <div className="space-y-2">
              <Label htmlFor="current-pin">PIN actuel</Label>
              <Input
                id="current-pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4,8}"
                maxLength={8}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••••"
                required={!isForcedReset}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-pin">Nouveau PIN (4 à 8 chiffres)</Label>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-pin">Confirmez le nouveau PIN</Label>
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

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </form>
      </div>
    </div>
  )
}
