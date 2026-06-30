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
import { PageHeader, PageSection, EmptyState, StatusBadge } from '@/components/design-system'
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
  const [createdSetupLink, setCreatedSetupLink] = useState<string | null>(null)
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
        setCreatedSetupLink(data.setupLink ?? null)
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
      <PageHeader
        title="Équipe"
        description="Gérez les utilisateurs de votre organisation."
        actions={
          canCreate
            ? [
                <Button key="invite" onClick={() => setInviteOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Inviter
                </Button>,
              ]
            : undefined
        }
      />

      {toggleError && <StatusBadge variant="danger">{toggleError}</StatusBadge>}

      {myInvitations && myInvitations.length > 0 && (
        <PageSection title="Invitations reçues">
          <MyInvitations invitations={myInvitations} />
        </PageSection>
      )}

      <PageSection title="Membres de l’équipe">
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
        {!isLoading && !error && members?.length === 0 && (
          <EmptyState
            title="Aucun membre"
            description="Vous êtes seul pour l’instant. Invitez des collaborateurs pour commencer."
            action={
              canCreate ? (
                <Button onClick={() => setInviteOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Inviter
                </Button>
              ) : undefined
            }
          />
        )}
      </PageSection>

      {invitations && invitations.length > 0 && (
        <PageSection title="Invitations en attente">
          <InvitationList
            invitations={invitations}
            onCancel={(id) => declineInvitation.mutate(id)}
            isLoading={declineInvitation.isPending}
          />
        </PageSection>
      )}

      {switchError && <StatusBadge variant="danger">{switchError}</StatusBadge>}

      {myOrganizations && myOrganizations.length > 1 && (
        <PageSection title="Mes organisations">
          <OrgSwitcher
            organizations={myOrganizations}
            onSwitch={handleSwitchOrg}
            isSwitching={isSwitching}
          />
        </PageSection>
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
            setCreatedSetupLink(null)
          }
        }}
        onCreateUser={handleCreateUser}
        onInviteByEmail={handleInviteByEmail}
        createdPin={createdPin}
        setupLink={createdSetupLink}
        isLoading={createUser.isPending || createInvitation.isPending}
        error={createUser.error ?? createInvitation.error}
      />
    </div>
  )
}
