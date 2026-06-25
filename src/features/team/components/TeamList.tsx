import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KeyRound, Power, PowerOff } from 'lucide-react'
import type { TeamMember } from '@/types'
import { USER_ROLE_LABELS } from '../constants'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

interface TeamListProps {
  members: TeamMember[]
  currentMembershipId: string
  onToggleActive: (member: TeamMember) => void
  onResetPin: (member: TeamMember) => void
  isUpdating?: boolean
}

export function TeamList({
  members,
  currentMembershipId,
  onToggleActive,
  onResetPin,
  isUpdating,
}: TeamListProps) {
  const columns: ResponsiveColumn<TeamMember>[] = [
    {
      key: 'name',
      header: 'Nom',
      cell: (member) => (
        <>
          {member.name}
          {member.membershipId === currentMembershipId && (
            <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
          )}
        </>
      ),
      className: 'font-medium',
    },
    {
      key: 'email',
      header: 'Email',
      cell: (member) => member.email,
      className: 'text-sm',
    },
    { key: 'role', header: 'Rôle', cell: (member) => USER_ROLE_LABELS[member.role] },
    {
      key: 'status',
      header: 'Statut',
      cell: (member) =>
        member.isActive ? (
          <Badge variant="default">Actif</Badge>
        ) : (
          <Badge variant="secondary">Inactif</Badge>
        ),
    },
    {
      key: 'lastLogin',
      header: 'Dernière connexion',
      cell: (member) =>
        member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString('fr-FR') : 'Jamais',
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (member) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onResetPin(member)}
            disabled={Boolean(isUpdating) || member.membershipId === currentMembershipId}
            aria-label={`Réinitialiser le PIN de ${member.name}`}
            title="Réinitialiser le PIN"
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleActive(member)}
            disabled={Boolean(isUpdating) || member.membershipId === currentMembershipId}
            aria-label={member.isActive ? `Désactiver ${member.name}` : `Activer ${member.name}`}
            title={member.isActive ? 'Désactiver' : 'Activer'}
          >
            {member.isActive ? (
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
      data={members}
      columns={columns}
      keyExtractor={(member) => member.membershipId}
      empty={empty}
      mobileCardTitle={(member) => member.name}
    />
  )
}
