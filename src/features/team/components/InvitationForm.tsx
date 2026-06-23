import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { UserRole } from '@/types'

interface InvitationFormProps {
  onSubmit: (input: { email: string; role: UserRole }) => void
  isLoading: boolean
}

export function InvitationForm({ onSubmit, isLoading }: InvitationFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('operator')

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit({ email, role })
    setEmail('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="collegue@exemple.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-role">Rôle</Label>
          <Select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="admin">Administrateur</option>
            <option value="operator">Opérateur</option>
            <option value="reader">Lecteur</option>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={isLoading}>
        Envoyer l'invitation
      </Button>
    </form>
  )
}
