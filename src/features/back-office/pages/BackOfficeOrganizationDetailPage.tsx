import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  getOrganization,
  listUsers,
  setOrganizationPlan,
  suspendOrganization,
} from '../services/platformService'
import type { ActivityLogRow, BackOfficeOrganization, BackOfficeUser, Paginated } from '../types'

const PLANS = ['free', 'starter', 'pro', 'enterprise']

export default function BackOfficeOrganizationDetailPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { platformAdminRole, enterSudo } = useAuth()
  const isSuperAdmin = platformAdminRole === 'super_admin'
  const safeOrgId = orgId ?? ''

  const orgQuery = useQuery<{
    organization: BackOfficeOrganization
    recentActivity: ActivityLogRow[]
  }>({
    queryKey: ['back-office', 'organization', safeOrgId],
    queryFn: () => getOrganization(safeOrgId),
    enabled: !!orgId,
  })

  const usersQuery = useQuery<Paginated<BackOfficeUser>>({
    queryKey: ['back-office', 'users', { orgId: safeOrgId }],
    queryFn: () => listUsers({ orgId: safeOrgId, limit: 100 }),
    enabled: !!orgId,
  })

  const planMutation = useMutation({
    mutationFn: (plan: string) => setOrganizationPlan(safeOrgId, plan),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['back-office', 'organization', safeOrgId] }),
  })

  const suspendMutation = useMutation({
    mutationFn: (isSuspended: boolean) =>
      suspendOrganization(safeOrgId, isSuspended, isSuspended ? undefined : 'Manual suspension'),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['back-office', 'organization', safeOrgId] }),
  })

  if (!orgId) return <div>Identifiant manquant</div>

  const org = orgQuery.data?.organization
  const subscription = org
    ? Array.isArray(org.subscriptions)
      ? org.subscriptions[0]
      : org.subscriptions
    : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/back-office/organizations')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Button>
      </div>

      {orgQuery.error && <p className="text-destructive">{orgQuery.error.message}</p>}

      {org && (
        <>
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{org.name}</h1>
                {org.is_suspended ? (
                  <Badge variant="destructive">Suspendue</Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {org.currency} • {org.timezone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isSuperAdmin && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void enterSudo({ type: 'organization', id: org.id, name: org.name }).then(() =>
                      navigate('/dashboard')
                    )
                  }
                >
                  <ShieldAlert className="mr-2 h-4 w-4" /> Sudo
                </Button>
              )}
              {isSuperAdmin && (
                <Button
                  variant={org.is_suspended ? 'default' : 'outline'}
                  onClick={() => suspendMutation.mutate(!org.is_suspended)}
                  disabled={suspendMutation.isPending}
                >
                  {org.is_suspended ? 'Réactiver' : 'Suspendre'}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Utilisateurs" value={org.users_count ?? 0} />
            <Stat label="Produits" value={org.products_count ?? 0} />
            <Stat label="Emplacements" value={org.locations_count ?? 0} />
            <Stat label="Plan" value={subscription?.plan_id ?? '—'} />
          </div>

          {isSuperAdmin && (
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <span className="text-sm font-medium">Plan :</span>
              <Select
                value={subscription?.plan_id ?? 'free'}
                onChange={(e) => planMutation.mutate(e.target.value)}
                disabled={planMutation.isPending}
              >
                {PLANS.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Membres</h2>
            <div className="mt-3 space-y-2">
              {usersQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : usersQuery.data?.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun membre.</p>
              ) : (
                usersQuery.data?.data.map((user) => {
                  const membership = user.organization_memberships.find((m) => m.org_id === orgId)
                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{user.name || user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {membership?.role} • {user.email}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/back-office/users/${user.id}`)}
                      >
                        Voir
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Activité récente</h2>
            <div className="mt-3 space-y-2">
              {orgQuery.data?.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune activité.</p>
              ) : (
                orgQuery.data?.recentActivity.map((log) => (
                  <div key={log.id} className="text-sm">
                    <Badge variant="outline">{log.action}</Badge>{' '}
                    <span className="text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('fr-FR')}
                    </span>
                    <p className="text-muted-foreground">
                      {log.target_type}:{log.target_id}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
