import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  listOrganizations,
  suspendOrganization,
  setOrganizationPlan,
} from '../services/platformService'

interface OrganizationRow {
  id: string
  name: string
  currency: string
  timezone: string
  is_active: boolean
  is_suspended: boolean
  suspension_reason: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
  subscriptions: {
    plan_id: string
    status: string
    current_period_ends_at: string
  }[]
}

const plans = ['free', 'starter', 'pro', 'enterprise']

const ORGANIZATIONS_QUERY_KEY = ['platform-organizations']

async function loadOrganizations(): Promise<OrganizationRow[]> {
  const data = await listOrganizations()
  return data as OrganizationRow[]
}

export default function SuperAdminPage() {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const {
    data: organizations = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ORGANIZATIONS_QUERY_KEY,
    queryFn: loadOrganizations,
  })

  const suspendMutation = useMutation({
    mutationFn: async (org: OrganizationRow) => {
      await suspendOrganization(
        org.id,
        !org.is_suspended,
        org.is_suspended ? undefined : 'Manual suspension'
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY }),
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Action failed'),
  })

  const planMutation = useMutation({
    mutationFn: ({ orgId, planId }: { orgId: string; planId: string }) =>
      setOrganizationPlan(orgId, planId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY }),
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Plan update failed'),
  })

  const error = actionError ?? (queryError instanceof Error ? queryError.message : null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Super Admin</h1>
        <p className="text-muted-foreground">Gestion des organisations et abonnements.</p>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-3">
          {organizations.map((org) => {
            const subscription = org.subscriptions.at(0)
            return (
              <div
                key={org.id}
                className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{org.name}</p>
                    {org.is_suspended ? (
                      <Badge variant="destructive">Suspendue</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Plan : {subscription?.plan_id ?? '—'} • {subscription?.status ?? '—'} • fin :{' '}
                    {subscription
                      ? new Date(subscription.current_period_ends_at).toLocaleDateString('fr-FR')
                      : '—'}
                  </p>
                  {org.suspension_reason && (
                    <p className="text-xs text-destructive">Raison : {org.suspension_reason}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Créée le {new Date(org.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={subscription?.plan_id ?? 'free'}
                    onChange={(e) => planMutation.mutate({ orgId: org.id, planId: e.target.value })}
                  >
                    {plans.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant={org.is_suspended ? 'default' : 'outline'}
                    onClick={() => suspendMutation.mutate(org)}
                    disabled={suspendMutation.isPending}
                  >
                    {org.is_suspended ? 'Réactiver' : 'Suspendre'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
