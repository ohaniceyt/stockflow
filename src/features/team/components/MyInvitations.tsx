import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useAcceptInvitation, useDeclineInvitation } from '../hooks/useInvitations'
import type { MyInvitation } from '../services/invitationService'

interface MyInvitationsProps {
  invitations: MyInvitation[]
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  operator: 'Opérateur',
  viewer: 'Lecteur',
  reader: 'Lecteur',
}

export function MyInvitations({ invitations }: MyInvitationsProps) {
  const { switchMembership } = useAuth()
  const accept = useAcceptInvitation()
  const decline = useDeclineInvitation()

  const handleAccept = (invitationId: string) => {
    accept.mutate(invitationId, {
      onSuccess: (data) => {
        void switchMembership(data.membershipId)
      },
    })
  }

  return (
    <div className="space-y-3">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">{invitation.organizationName}</p>
            <p className="text-sm text-muted-foreground">
              Rôle :{' '}
              <span className="capitalize">{roleLabels[invitation.role] ?? invitation.role}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={decline.isPending || accept.isPending}
              onClick={() => decline.mutate(invitation.id)}
            >
              Refuser
            </Button>
            <Button
              size="sm"
              disabled={accept.isPending || decline.isPending}
              onClick={() => handleAccept(invitation.id)}
            >
              Accepter
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
