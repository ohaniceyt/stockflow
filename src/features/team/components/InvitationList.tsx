import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Invitation } from '../services/invitationService'

interface InvitationListProps {
  invitations: Invitation[]
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  isLoading?: boolean
}

export function InvitationList({ invitations, onAccept, onDecline, isLoading }: InvitationListProps) {
  if (invitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune invitation en attente.</p>
    )
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
              Rôle : <span className="capitalize">{invitation.role}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => onDecline(invitation.id)}
            >
              <X className="mr-1 h-4 w-4" />
              Refuser
            </Button>
            <Button
              size="sm"
              disabled={isLoading}
              onClick={() => onAccept(invitation.id)}
            >
              <Check className="mr-1 h-4 w-4" />
              Accepter
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
