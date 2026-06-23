import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/context/AuthContext'
import { TeamList } from '../components/TeamList'
import { ResetPinDialog } from '../components/ResetPinDialog'
import { InviteUserDialog } from '../components/InviteUserDialog'
import { InvitationList } from '../components/InvitationList'
import { OrgSwitcher } from '../components/OrgSwitcher'
import {
  useCreateInvitation,
  useDeclineInvitation,
  useInvitations,
  useMyOrganizations,
} from '../hooks/useInvitations'
import { useCreateUser, useResetUserPin, useTeamUsers, useUpdateUserActive } from '../hooks/useTeam'
import type { User } from '@/types'

export default function TeamPage() {
  const { session, hasRole, logout } = useAuth()
  const { data: users, isLoading, error } = useTeamUsers()
  const updateActive = useUpdateUserActive()
  const resetPin = useResetUserPin()
  const createUser = useCreateUser()

  const { data: invitations } = useInvitations()
  const { data: myOrganizations } = useMyOrganizations()
  const createInvitation = useCreateInvitation()
  const declineInvitation = useDeclineInvitation()

  const canCreate = hasRole(['super_admin', 'admin'])

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [createdPin, setCreatedPin] = useState<string | null>(null)

  const handleToggleActive = (user: User) => {
    updateActive.mutate({ id: user.id, isActive: !user.isActive })
  }

  const handleResetPin = (user: User) => {
    setSelectedUser(user)
    setResetOpen(true)
  }

  const handleConfirmReset = (newPin: string) => {
    if (!selectedUser) return
    resetPin.mutate(
      { userId: selectedUser.id, newPin },
      {
        onSuccess: () => {
          setResetOpen(false)
          setSelectedUser(null)
        },
      }
    )
  }

  const handleCreateUser = (input: { name: string; email: string; role: User['role'] }) => {
    createUser.mutate(input, {
      onSuccess: (data) => {
        setCreatedPin(data.tempPin)
      },
    })
  }

  const handleInviteByEmail = (input: { email: string; role: User['role'] }) => {
    createInvitation.mutate(input, {
      onSuccess: () => {
        setInviteOpen(false)
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Équipe</h1>
          <p className="text-muted-foreground">Gérez les utilisateurs de votre organisation.</p>
        </div>
        {canCreate && (
          <Button className="w-full sm:w-auto" onClick={() => setInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Inviter
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement de l'équipe…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {!isLoading && !error && users && (
        <TeamList
          users={users}
          currentUserId={session?.user.id ?? ''}
          onToggleActive={handleToggleActive}
          onResetPin={handleResetPin}
          isUpdating={updateActive.isPending || resetPin.isPending}
        />
      )}

      {invitations && invitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Invitations en attente</h2>
          <InvitationList
            invitations={invitations}
            onCancel={(id) => declineInvitation.mutate(id)}
            isLoading={declineInvitation.isPending}
          />
        </div>
      )}

      {myOrganizations && myOrganizations.length > 1 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <OrgSwitcher
            organizations={myOrganizations}
            onSwitch={() => {
              // Switching orgs requires re-login with the same auth user
              // because the current session is tied to one org row.
              logout()
              window.location.href = '/login'
            }}
          />
        </div>
      )}

      <ResetPinDialog
        userName={selectedUser?.name ?? null}
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={handleConfirmReset}
        isLoading={resetPin.isPending}
      />

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open)
          if (!open) {
            setCreatedPin(null)
          }
        }}
        onCreateUser={handleCreateUser}
        onInviteByEmail={handleInviteByEmail}
        createdPin={createdPin}
        isLoading={createUser.isPending || createInvitation.isPending}
      />
    </div>
  )
}
