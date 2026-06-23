import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KeyRound, Power, PowerOff } from 'lucide-react'
import type { User } from '@/types'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

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
  const columns: ResponsiveColumn<User>[] = [
    {
      key: 'name',
      header: 'Nom',
      cell: (user) => (
        <>
          {user.name}
          {user.id === currentUserId && (
            <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
          )}
        </>
      ),
      className: 'font-medium',
    },
    {
      key: 'email',
      header: 'Email',
      cell: (user) => (
        <>
          {user.email}
          {!user.emailVerified && (
            <Badge variant="outline" className="ml-2">
              Email non vérifié
            </Badge>
          )}
        </>
      ),
      className: 'text-sm',
    },
    { key: 'role', header: 'Rôle', cell: (user) => roleLabels[user.role] },
    {
      key: 'status',
      header: 'Statut',
      cell: (user) =>
        user.isActive ? (
          <Badge variant="default">Actif</Badge>
        ) : (
          <Badge variant="secondary">Inactif</Badge>
        ),
    },
    {
      key: 'lastLogin',
      header: 'Dernière connexion',
      cell: (user) =>
        user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : 'Jamais',
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (user) => (
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
      ),
    },
  ]

  const empty = (
    <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
      Aucun utilisateur dans l'organisation.
    </div>
  )

  return (
    <ResponsiveTable
      data={users}
      columns={columns}
      keyExtractor={(user) => user.id}
      empty={empty}
      mobileCardTitle={(user) => user.name}
    />
  )
}
