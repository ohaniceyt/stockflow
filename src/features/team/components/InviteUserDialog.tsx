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
import type { User } from '@/types'

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { name: string; email: string; role: User['role'] }) => void
  createdPin: string | null
  isLoading?: boolean
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onSubmit,
  createdPin,
  isLoading,
}: InviteUserDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<User['role']>('operator')
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email', string>>>({})

  const validate = () => {
    const next: Partial<Record<'name' | 'email', string>> = {}
    if (!name.trim()) next.name = 'Le nom est requis'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Adresse email invalide'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ name: name.trim(), email: email.trim().toLowerCase(), role })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un utilisateur</DialogTitle>
          <DialogDescription>
            Créez un compte avec un PIN temporaire à communiquer.
          </DialogDescription>
        </DialogHeader>

        {createdPin ? (
          <div className="space-y-4 py-4">
            <div className="rounded-xl bg-green-50 p-4 text-center">
              <p className="text-sm text-green-700">Utilisateur créé avec succès.</p>
              <p className="mt-2 text-xs text-muted-foreground">PIN temporaire :</p>
              <p className="text-2xl font-bold tracking-widest text-green-700">{createdPin}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Communiquez ce PIN de manière sécurisée.
              </p>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nom complet</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Charlie Comptable"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="charlie@exemple.com"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Rôle</Label>
              <Select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as User['role'])}
              >
                <option value="admin">Admin</option>
                <option value="operator">Opérateur</option>
                <option value="reader">Lecteur</option>
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
                {isLoading ? 'Création…' : 'Créer'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
