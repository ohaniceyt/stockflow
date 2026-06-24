import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/context/AuthContext'

export function PinSetupPrompt() {
  const { session, setPin } = useAuth()
  const [pin, setPinValue] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  if (session?.membership.pinHash !== null) return null

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (pin.length < 4 || pin.length > 8) {
      setError('Le PIN doit comporter entre 4 et 8 chiffres.')
      return
    }
    if (pin !== confirmPin) {
      setError('Les PIN ne correspondent pas.')
      return
    }

    setIsLoading(true)
    try {
      await setPin(pin)
      setPinValue('')
      setConfirmPin('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la création du PIN.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Sécurisez votre accès</DialogTitle>
          <DialogDescription className="text-center">
            Choisissez un code PIN pour déverrouiller rapidement StockFlow sur cet appareil.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="pin">Nouveau PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
              placeholder="4 à 8 chiffres"
              className="text-center text-2xl tracking-widest"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirmer le PIN</Label>
            <Input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirmez le PIN"
              className="text-center text-2xl tracking-widest"
              required
            />
          </div>

          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isLoading || !pin || !confirmPin}>
            {isLoading ? 'Enregistrement…' : 'Activer le verrouillage'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
