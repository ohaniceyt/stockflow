import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { USER_ROLES, USER_ROLE_LABELS } from '../constants'
import type { UserRole } from '@/types'

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateUser: (input: { name: string; email: string; role: UserRole }) => void
  onInviteByEmail?: (input: { email: string; role: UserRole }) => void
  createdPin: string | null
  setupLink?: string | null
  isLoading?: boolean
  error?: Error | null
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onCreateUser,
  onInviteByEmail,
  createdPin,
  setupLink,
  isLoading,
  error,
}: InviteUserDialogProps) {
  const [mode, setMode] = useState<'create' | 'invite'>('create')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('cashier')
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email', string>>>({})

  const validate = () => {
    const next: Partial<Record<'name' | 'email', string>> = {}
    if (mode === 'create' && !name.trim()) next.name = 'Le nom est requis'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Adresse email invalide'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    if (mode === 'create') {
      onCreateUser({ name: name.trim(), email: email.trim().toLowerCase(), role })
    } else if (onInviteByEmail) {
      onInviteByEmail({ email: email.trim().toLowerCase(), role })
      setEmail('')
    }
  }

  const reset = () => {
    setMode('create')
    setName('')
    setEmail('')
    setRole('operator')
    setErrors({})
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un utilisateur</DialogTitle>
          <DialogDescription>
            Créez un compte immédiatement ou envoyez une invitation par email.
          </DialogDescription>
        </DialogHeader>

        {createdPin ? (
          <div className="space-y-4 py-4">
            <div className="rounded-xl bg-green-50 p-4 text-center">
              <p className="text-sm text-green-700">Utilisateur créé avec succès.</p>
              <p className="mt-2 text-sm text-muted-foreground">PIN temporaire :</p>
              <p className="text-2xl font-bold tracking-widest text-green-700">{createdPin}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                L'utilisateur doit d'abord définir son mot de passe via le lien ci-dessous, puis se
                connecter pour choisir son PIN définitif.
              </p>
              {setupLink && (
                <div className="mt-3 text-left">
                  <p className="text-sm text-muted-foreground">
                    Lien de configuration du mot de passe :
                  </p>
                  <a
                    href={setupLink}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-sm text-green-700 underline"
                  >
                    {setupLink}
                  </a>
                </div>
              )}
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'create' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                Créer maintenant
              </button>
              <button
                type="button"
                onClick={() => setMode('invite')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'invite' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                Inviter par email
              </button>
            </div>

            {mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="invite-name">Nom complet</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Charlie Comptable"
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="charlie@exemple.com"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Rôle</Label>
              <Select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {USER_ROLES.filter((r) => r !== 'super_admin').map((r) => (
                  <option key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Envoi…' : mode === 'create' ? 'Créer' : 'Envoyer invitation'}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error.message}</p>}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
