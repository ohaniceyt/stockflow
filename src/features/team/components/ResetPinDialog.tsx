import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ResetPinDialogProps {
  userName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (newPin: string) => void
  isLoading?: boolean
}

export function ResetPinDialog({
  userName,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: ResetPinDialogProps) {
  const [pin, setPin] = useState('')

  const handleConfirm = () => {
    onConfirm(pin)
    setPin('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le PIN</DialogTitle>
          <DialogDescription>
            Définissez un nouveau PIN temporaire pour {userName ?? 'cet utilisateur'}. L'utilisateur
            devra le changer à sa prochaine connexion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-pin">Nouveau PIN (4 à 8 chiffres)</Label>
            <Input
              id="new-pin"
              type="text"
              inputMode="numeric"
              pattern="\d{4,8}"
              minLength={4}
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="1234"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={Boolean(isLoading) || pin.length < 4}>
            {isLoading ? 'Enregistrement…' : 'Réinitialiser'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
