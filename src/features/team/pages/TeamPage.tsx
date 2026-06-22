import { useState } from 'react'
import { useAuth } from '@/features/auth/context/AuthContext'
import { TeamList } from '../components/TeamList'
import { ResetPinDialog } from '../components/ResetPinDialog'
import { useResetUserPin, useTeamUsers, useUpdateUserActive } from '../hooks/useTeam'
import type { User } from '@/types'

export default function TeamPage() {
  const { session } = useAuth()
  const { data: users, isLoading, error } = useTeamUsers()
  const updateActive = useUpdateUserActive()
  const resetPin = useResetUserPin()

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Équipe</h1>
        <p className="text-muted-foreground">Gérez les utilisateurs de votre organisation.</p>
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

      <ResetPinDialog
        userName={selectedUser?.name ?? null}
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={handleConfirmReset}
        isLoading={resetPin.isPending}
      />
    </div>
  )
}
