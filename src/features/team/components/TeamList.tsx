import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { KeyRound, Power, PowerOff } from 'lucide-react'
import type { User } from '@/types'

interface TeamListProps {
  users: User[]
  currentUserId: string
  onToggleActive: (user: User) => void
  onResetPin: (user: User) => void
  isUpdating?: boolean
}

const roleLabels: Record<User['role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  operator: 'Opérateur',
  reader: 'Lecteur',
}

export function TeamList({
  users,
  currentUserId,
  onToggleActive,
  onResetPin,
  isUpdating,
}: TeamListProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Aucun utilisateur dans l'organisation.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Rôle</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Dernière connexion</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">
              {user.name}
              {user.id === currentUserId && (
                <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
              )}
            </TableCell>
            <TableCell className="text-sm">
              {user.email}
              {!user.emailVerified && (
                <Badge variant="outline" className="ml-2">
                  Email non vérifié
                </Badge>
              )}
            </TableCell>
            <TableCell>{roleLabels[user.role]}</TableCell>
            <TableCell>
              {user.isActive ? (
                <Badge variant="default">Actif</Badge>
              ) : (
                <Badge variant="secondary">Inactif</Badge>
              )}
            </TableCell>
            <TableCell>
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onResetPin(user)}
                  disabled={Boolean(isUpdating) || user.id === currentUserId}
                  aria-label={`Réinitialiser le PIN de ${user.name}`}
                  title="Réinitialiser le PIN"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleActive(user)}
                  disabled={Boolean(isUpdating) || user.id === currentUserId}
                  aria-label={user.isActive ? `Désactiver ${user.name}` : `Activer ${user.name}`}
                  title={user.isActive ? 'Désactiver' : 'Activer'}
                >
                  {user.isActive ? (
                    <PowerOff className="h-4 w-4 text-destructive" />
                  ) : (
                    <Power className="h-4 w-4 text-green-600" />
                  )}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
