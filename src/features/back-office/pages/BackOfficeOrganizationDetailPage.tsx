import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowLeft,
  ShieldAlert,
  History,
  Edit3,
  Users,
  Package,
  MapPin,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  getOrganization,
  listUsers,
  setOrganizationPlan,
  suspendOrganization,
  updateOrganizationSlug,
  getOrganizationSlugHistory,
} from '../services/platformService'
import { PageHeader, PageSection, DataCard, StatusBadge } from '@/components/design-system'
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['back-office', 'organization', safeOrgId] })
    },
  })

  const suspendMutation = useMutation({
    mutationFn: (isSuspended: boolean) =>
      suspendOrganization(safeOrgId, isSuspended, isSuspended ? undefined : 'Manual suspension'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['back-office', 'organization', safeOrgId] })
    },
  })

  const slugHistoryQuery = useQuery({
    queryKey: ['back-office', 'organization', safeOrgId, 'slug-history'],
    queryFn: () => getOrganizationSlugHistory(safeOrgId),
    enabled: !!orgId && isSuperAdmin,
  })

  const slugMutation = useMutation({
    mutationFn: (newSlug: string) => updateOrganizationSlug(safeOrgId, newSlug),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['back-office', 'organization', safeOrgId] })
      await queryClient.invalidateQueries({
        queryKey: ['back-office', 'organization', safeOrgId, 'slug-history'],
      })
    },
  })

  const [showSlugForm, setShowSlugForm] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)

  if (!orgId) return <div>Identifiant manquant</div>

  const org = orgQuery.data?.organization
  const subscription = org
    ? Array.isArray(org.subscriptions)
      ? org.subscriptions[0]
      : org.subscriptions
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={org?.name ?? 'Organisation'}
        description="Détails et administration de l'organisation."
      />

      <Button variant="ghost" size="sm" onClick={() => navigate('/back-office/organizations')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour
      </Button>

      <PageSection>
        {orgQuery.isLoading && <p className="text-muted-foreground">Chargement…</p>}
        {orgQuery.error && <p className="text-destructive">{orgQuery.error.message}</p>}

        {org && (
          <>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                {org.is_suspended ? (
                  <StatusBadge variant="danger">Suspendue</StatusBadge>
                ) : (
                  <StatusBadge variant="success">Active</StatusBadge>
                )}
                <span className="text-muted-foreground">
                  {org.currency} • {org.timezone}
                </span>
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
              <DataCard label="Utilisateurs" value={org.users_count ?? 0} icon={Users} status="neutral" />
              <DataCard label="Produits" value={org.products_count ?? 0} icon={Package} status="neutral" />
              <DataCard label="Emplacements" value={org.locations_count ?? 0} icon={MapPin} status="neutral" />
              <DataCard
                label="Plan"
                value={subscription?.plan_id ?? '—'}
                icon={CheckCircle}
                status="neutral"
              />
            </div>

            {isSuperAdmin && (
              <div className="flex items-center gap-2">
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

            {isSuperAdmin && (
              <PageSection title="Identifiant public (slug)">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Slug actuel : <span className="font-mono text-foreground">{org.slug}</span>
                  </p>
                </div>
                {!showSlugForm && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowSlugForm(true)}
                  >
                    Modifier
                  </Button>
                )}
                {showSlugForm && (
                  <form
                    className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start"
                    onSubmit={(e) => {
                      e.preventDefault()
                      setSlugError(null)
                      if (!newSlug.trim() || newSlug.trim().length < 2) {
                        setSlugError('Slug trop court')
                        return
                      }
                      slugMutation.mutate(newSlug.trim().toLowerCase(), {
                        onSuccess: () => {
                          setShowSlugForm(false)
                          setNewSlug('')
                        },
                        onError: (err) => setSlugError(err.message),
                      })
                    }}
                  >
                    <Input
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      placeholder="nouveau-slug"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={slugMutation.isPending}>
                        {slugMutation.isPending ? '…' : 'Valider'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowSlugForm(false)
                          setNewSlug('')
                          setSlugError(null)
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </form>
                )}
                {slugError && <p className="text-sm text-destructive">{slugError}</p>}
              </PageSection>
            )}

            {isSuperAdmin && slugHistoryQuery.data && slugHistoryQuery.data.length > 0 && (
              <PageSection title="Historique des slugs">
                <div className="mb-3 flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  {slugHistoryQuery.data.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-muted-foreground">{entry.old_slug}</span>
                        <span>→</span>
                        <span className="font-mono">{entry.new_slug}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(entry.changed_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>
              </PageSection>
            )}

            <PageSection title="Membres">
              {usersQuery.isLoading ? (
                <p className="text-muted-foreground">Chargement…</p>
              ) : usersQuery.data?.data.length === 0 ? (
                <p className="text-muted-foreground">Aucun membre.</p>
              ) : (
                <div className="space-y-2">
                  {usersQuery.data?.data.map((user) => {
                    const membership = user.organization_memberships.find((m) => m.org_id === orgId)
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{user.name || user.email}</p>
                          <p className="text-sm text-muted-foreground">
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
                  })}
                </div>
              )}
            </PageSection>

            <PageSection title="Activité récente">
              {orgQuery.data?.recentActivity.length === 0 ? (
                <p className="text-muted-foreground">Aucune activité.</p>
              ) : (
                <div className="space-y-2">
                  {orgQuery.data?.recentActivity.map((log) => (
                    <div key={log.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <StatusBadge variant="neutral">{log.action}</StatusBadge>
                        <span className="text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {log.target_type}:{log.target_id}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </PageSection>

            {(planMutation.error ?? suspendMutation.error) && (
              <StatusBadge variant="danger">
                {(planMutation.error ?? suspendMutation.error)?.message}
              </StatusBadge>
            )}
          </>
        )}
      </PageSection>
    </div>
  )
}
