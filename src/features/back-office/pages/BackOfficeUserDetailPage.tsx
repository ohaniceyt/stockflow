import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lock, Mail, ShieldAlert, History, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  getUser,
  resetUserPin,
  sendPasswordReset,
  toggleUserActive,
} from '../services/platformService'
import { usePlatformChallenge } from '../hooks/usePlatformChallenge'
import { PageHeader, PageSection, StatusBadge } from '@/components/design-system'
import type { ActivityLogRow, BackOfficeUser, LoginAttemptRow } from '../types'

export default function BackOfficeUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { platformAdminRole } = useAuth()
  const { requestChallenge } = usePlatformChallenge()
  const isSuperAdmin = platformAdminRole === 'super_admin'
  const safeUserId = userId ?? ''

  const userQuery = useQuery<{
    user: BackOfficeUser
    recentActivity: ActivityLogRow[]
    loginAttempts: LoginAttemptRow[]
  }>({
    queryKey: ['back-office', 'user', safeUserId],
    queryFn: () => getUser(safeUserId),
    enabled: !!userId,
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ membershipId, isActive }: { membershipId: string; isActive: boolean }) => {
      const challengeId = await requestChallenge('Activer/désactiver un membre')
      return toggleUserActive(membershipId, isActive, challengeId)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['back-office', 'user', safeUserId] }),
  })

  const resetPinMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const challengeId = await requestChallenge('Réinitialiser le PIN')
      return resetUserPin(membershipId, challengeId)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['back-office', 'user', safeUserId] }),
  })

  const passwordResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const challengeId = await requestChallenge('Envoyer un reset mot de passe')
      return sendPasswordReset(email, challengeId)
    },
  })

  if (!userId) return <div>Identifiant manquant</div>

  const user = userQuery.data?.user
  const attempts = userQuery.data?.loginAttempts ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={user?.name ?? user?.email ?? 'Utilisateur'}
        description="Détails et administration de l'utilisateur."
      />

      <Button variant="ghost" size="sm" onClick={() => navigate('/back-office/users')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Retour
      </Button>

      <PageSection>
        {userQuery.isLoading && <p className="text-muted-foreground">Chargement…</p>}
        {userQuery.error && <p className="text-destructive">{userQuery.error.message}</p>}

        {user && (
          <>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <p className="text-muted-foreground">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {user.email_verified ? (
                    <StatusBadge variant="success">Vérifié</StatusBadge>
                  ) : (
                    <StatusBadge variant="neutral">Non vérifié</StatusBadge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => passwordResetMutation.mutate(user.email)}
                    disabled={passwordResetMutation.isPending}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Envoyer reset mdp
                  </Button>
                </div>
              </div>
            </div>

            <PageSection title="Membres et entreprises">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                {user.organization_memberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {membership.organizations?.name ?? membership.org_id}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {membership.role} • {membership.is_active ? 'Actif' : 'Inactif'} • dernier
                        login :{' '}
                        {membership.last_login_at
                          ? new Date(membership.last_login_at).toLocaleString('fr-FR')
                          : '—'}
                      </p>
                      {membership.force_pin_change && (
                        <StatusBadge variant="danger" className="mt-2">
                          PIN reset requis
                        </StatusBadge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                        title="L'impersonation d'entreprise est temporairement désactivée en attendant une implémentation serveur sécurisée."
                      >
                        <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Sudo indisponible
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetPinMutation.mutate(membership.id)}
                        disabled={resetPinMutation.isPending}
                      >
                        <Lock className="mr-2 h-4 w-4" /> Reset PIN
                      </Button>
                      {(isSuperAdmin || membership.role !== 'super_admin') && (
                        <Button
                          variant={membership.is_active ? 'secondary' : 'default'}
                          size="sm"
                          onClick={() =>
                            toggleMutation.mutate({
                              membershipId: membership.id,
                              isActive: !membership.is_active,
                            })
                          }
                          disabled={toggleMutation.isPending}
                        >
                          {membership.is_active ? 'Désactiver' : 'Activer'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </PageSection>

            <PageSection title="Tentatives de connexion (20 dernières)">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
              </div>
              {attempts.length === 0 ? (
                <p className="text-muted-foreground">Aucune tentative.</p>
              ) : (
                <div className="space-y-2">
                  {attempts.map((attempt, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {new Date(attempt.created_at).toLocaleString('fr-FR')}
                      </span>
                      {attempt.succeeded ? (
                        <StatusBadge variant="success">Réussie</StatusBadge>
                      ) : (
                        <StatusBadge variant="danger">Échouée</StatusBadge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </PageSection>

            {(passwordResetMutation.error ?? resetPinMutation.error ?? toggleMutation.error) && (
              <StatusBadge variant="danger">
                {
                  (passwordResetMutation.error ?? resetPinMutation.error ?? toggleMutation.error)
                    ?.message
                }
              </StatusBadge>
            )}
          </>
        )}
      </PageSection>
    </div>
  )
}
