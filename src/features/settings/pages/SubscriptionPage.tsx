import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/context/AuthContext'
import { changeOrganizationPlan, getOrgLimits } from '../services/subscriptionService'
import { SettingsTabs } from '../components/SettingsTabs'
import { PageHeader, PageSection, DataCard, StatusBadge } from '@/components/design-system'

function UsageBar({ used, max, label }: { used: number; max: number | null; label: string }) {
  const unlimited = max === null
  const pct = unlimited ? 0 : Math.min(100, Math.max(0, (used / max) * 100))
  const atLimit = !unlimited && used >= max

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used}
          {unlimited ? '' : ` / ${String(max)}`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            unlimited
              ? 'bg-muted-foreground'
              : atLimit
                ? 'bg-destructive'
                : pct >= 90
                  ? 'bg-amber-500'
                  : 'bg-primary'
          }`}
          style={{ width: unlimited ? '100%' : `${String(pct)}%` }}
        />
      </div>
      {!unlimited && atLimit && <p className="text-sm text-destructive">Limite atteinte</p>}
    </div>
  )
}

const plans = [
  { id: 'free', name: 'Gratuit', monthlyPrice: 0, yearlyPrice: 0 },
  { id: 'starter', name: 'Starter', monthlyPrice: 4900, yearlyPrice: 49900 },
  { id: 'pro', name: 'Pro', monthlyPrice: 9900, yearlyPrice: 99900 },
  { id: 'enterprise', name: 'Enterprise', monthlyPrice: 0, yearlyPrice: 0 },
]

export default function SubscriptionPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole(['super_admin', 'admin'])
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const {
    data: limits,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['org-limits'],
    queryFn: getOrgLimits,
  })

  const planMutation = useMutation({
    mutationFn: changeOrganizationPlan,
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['org-limits'], exact: true })
      setActionError(null)
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Erreur')
    },
  })

  const displayError = actionError ?? (error instanceof Error ? error.message : null)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Paramètres"
        description="Plan actuel et utilisation de vos quotas."
      />

      <SettingsTabs />

      {displayError && <p className="text-destructive">{displayError}</p>}

      {isLoading && <p className="text-muted-foreground">Chargement…</p>}

      {limits && (
        <>
          <PageSection
            title="Abonnement"
            description={`Plan actuel : ${limits.planId}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <DataCard
                label="Plan"
                value={limits.planId}
                icon={CreditCard}
                status={limits.isSuspended ? 'danger' : 'success'}
              />
              <StatusBadge variant={limits.isSuspended ? 'danger' : 'success'}>
                {limits.isSuspended ? 'Suspendue' : 'Active'}
              </StatusBadge>
            </div>

            <div className="space-y-4 pt-2">
              <UsageBar used={limits.usedUsers} max={limits.maxUsers} label="Utilisateurs" />
              <UsageBar used={limits.usedProducts} max={limits.maxProducts} label="Produits" />
              <UsageBar
                used={limits.usedLocations}
                max={limits.maxLocations}
                label="Emplacements"
              />
              <UsageBar
                used={limits.usedMovementsThisMonth}
                max={limits.maxMonthlyMovements}
                label="Mouvements ce mois"
              />
            </div>
          </PageSection>

          {canManage && (
            <PageSection
              title="Changer de plan"
              description="Sélectionnez un plan adapté à votre activité."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((plan) => {
                  const isCurrent = limits.planId === plan.id
                  const isFree = plan.monthlyPrice === 0 && plan.yearlyPrice === 0
                  const monthly = (plan.monthlyPrice / 100).toLocaleString('fr-FR')
                  const yearly = (plan.yearlyPrice / 100).toLocaleString('fr-FR')

                  return (
                    <div
                      key={plan.id}
                      className={`rounded-xl border p-4 ${isCurrent ? 'border-primary bg-primary/5' : 'bg-background'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{plan.name}</span>
                        {isCurrent && <StatusBadge variant="success">Actuel</StatusBadge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isFree ? 'Gratuit' : `${monthly} €/mois — ${yearly} €/an`}
                      </p>
                      <Button
                        variant={isCurrent ? 'secondary' : 'outline'}
                        size="sm"
                        className="mt-3 w-full"
                        disabled={isCurrent || planMutation.isPending}
                        onClick={() => planMutation.mutate(plan.id)}
                      >
                        {isCurrent ? 'Plan actuel' : 'Choisir ce plan'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </PageSection>
          )}
        </>
      )}
    </div>
  )
}
