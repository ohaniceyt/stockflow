import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useAcceptInvitation, useDeclineInvitation } from '../hooks/useInvitations'
import { USER_ROLE_LABELS } from '../constants'
import type { MyInvitation } from '../services/invitationService'

interface MyInvitationsProps {
  invitations: MyInvitation[]
}

export function MyInvitations({ invitations }: MyInvitationsProps) {
  const { switchMembership } = useAuth()
  const accept = useAcceptInvitation()
  const decline = useDeclineInvitation()
  const [invitationError, setInvitationError] = useState<string | null>(null)

  const handleAccept = (invitationId: string) => {
    setInvitationError(null)
    accept.mutate(invitationId, {
      onSuccess: (data) => {
        void switchMembership(data.membershipId)
      },
      onError: (err) => {
        setInvitationError(err.message)
      },
    })
  }

  const handleDecline = (invitationId: string) => {
    setInvitationError(null)
    decline.mutate(invitationId, {
      onError: (err) => {
        setInvitationError(err.message)
      },
    })
  }

  return (
    <div className="space-y-3">
      {(invitationError ?? accept.error ?? decline.error) && (
        <p className="text-sm text-destructive">
          {invitationError ?? accept.error?.message ?? decline.error?.message}
        </p>
      )}
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">{invitation.organizationName}</p>
            <p className="text-sm text-muted-foreground">
              Rôle : <span className="capitalize">{USER_ROLE_LABELS[invitation.role]}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={decline.isPending || accept.isPending}
              onClick={() => handleDecline(invitation.id)}
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
