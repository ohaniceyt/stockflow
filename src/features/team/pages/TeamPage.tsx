import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/context/AuthContext'
import { TeamList } from '../components/TeamList'
import { ResetPinDialog } from '../components/ResetPinDialog'
import { InviteUserDialog } from '../components/InviteUserDialog'
import { InvitationList } from '../components/InvitationList'
import { MyInvitations } from '../components/MyInvitations'
import { OrgSwitcher } from '../components/OrgSwitcher'
import {
  useCreateInvitation,
  useDeclineInvitation,
  useInvitations,
  useMyInvitations,
  useMyOrganizations,
} from '../hooks/useInvitations'
import { useCreateUser, useResetUserPin, useTeamUsers, useUpdateUserActive } from '../hooks/useTeam'
import type { TeamMember, UserRole } from '@/types'

export default function TeamPage() {
  const { session, hasRole, switchMembership } = useAuth()
  const { data: members, isLoading, error } = useTeamUsers()
  const updateActive = useUpdateUserActive()
  const resetPin = useResetUserPin()
  const createUser = useCreateUser()

  const { data: invitations } = useInvitations()
  const { data: myOrganizations } = useMyOrganizations()
  const { data: myInvitations } = useMyInvitations()
  const createInvitation = useCreateInvitation()
  const declineInvitation = useDeclineInvitation()

  const canCreate = hasRole(['super_admin', 'admin'])

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [createdPin, setCreatedPin] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const handleToggleActive = (member: TeamMember) => {
    setToggleError(null)
    updateActive.mutate(
      { id: member.membershipId, isActive: !member.isActive },
      {
        onError: (err) => {
          setToggleError(err.message)
        },
      }
    )
  }

  const handleResetPin = (member: TeamMember) => {
    setSelectedMember(member)
    setResetOpen(true)
  }

  const handleConfirmReset = (newPin: string) => {
    if (!selectedMember) return
    resetPin.mutate(
      { membershipId: selectedMember.membershipId, newPin },
      {
        onSuccess: () => {
          setResetOpen(false)
          setSelectedMember(null)
        },
      }
    )
  }

  const handleCreateUser = (input: { name: string; email: string; role: UserRole }) => {
    createUser.mutate(input, {
      onSuccess: (data) => {
        setCreatedPin(data.tempPin)
      },
    })
  }

  const handleInviteByEmail = (input: { email: string; role: UserRole }) => {
    createInvitation.mutate(input, {
      onSuccess: () => {
        setInviteOpen(false)
      },
    })
  }

  const handleSwitchOrg = async (membershipId: string) => {
    setIsSwitching(true)
    setSwitchError(null)
    try {
      await switchMembership(membershipId)
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Échec du changement d’organisation')
    } finally {
      setIsSwitching(false)
    }
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

      {toggleError && (
        <p className="rounded-lg border border-[var(--rose)] bg-[var(--rose-light)] p-3 text-sm text-[var(--rose)]">
          {toggleError}
        </p>
      )}

      {myInvitations && myInvitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Invitations reçues</h2>
          <MyInvitations invitations={myInvitations} />
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Chargement de l'équipe…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {!isLoading && !error && members && (
        <TeamList
          members={members}
          currentMembershipId={session?.membership.id ?? ''}
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

      {switchError && (
        <p className="rounded-lg border border-[var(--rose)] bg-[var(--rose-light)] p-3 text-sm text-[var(--rose)]">
          {switchError}
        </p>
      )}

      {myOrganizations && myOrganizations.length > 1 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <OrgSwitcher
            organizations={myOrganizations}
            onSwitch={handleSwitchOrg}
            isSwitching={isSwitching}
          />
        </div>
      )}

      <ResetPinDialog
        userName={selectedMember?.name ?? null}
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={handleConfirmReset}
        isLoading={resetPin.isPending}
        error={resetPin.error}
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
        error={createUser.error ?? createInvitation.error}
      />
    </div>
  )
}
