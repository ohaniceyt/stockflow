import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { getOrgLimits } from '../services/subscriptionService'

function UsageBar({ used, max, label }: { used: number; max: number | null; label: string }) {
  const cappedMax = max ?? Number.POSITIVE_INFINITY
  const pct = max === null ? 0 : Math.min(100, Math.max(0, (used / max) * 100))
  const unlimited = max === null

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
          className={`h-full rounded-full ${unlimited ? 'bg-muted-foreground' : pct >= 90 ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: unlimited ? '100%' : `${String(pct)}%` }}
        />
      </div>
      {!unlimited && used >= cappedMax && (
        <p className="text-xs text-destructive">Limite atteinte</p>
      )}
    </div>
  )
}

export default function SubscriptionPage() {
  const {
    data: limits,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['org-limits'],
    queryFn: getOrgLimits,
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Abonnement</h1>
        <p className="text-muted-foreground">Plan actuel et utilisation de vos quotas.</p>
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {error && (
        <p className="text-destructive">{error instanceof Error ? error.message : 'Erreur'}</p>
      )}

      {limits && (
        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-lg font-semibold capitalize">{limits.planId}</p>
            </div>
            {limits.isSuspended ? (
              <Badge variant="destructive">Suspendue</Badge>
            ) : (
              <Badge variant="default">Active</Badge>
            )}
          </div>

          <div className="space-y-4 pt-2">
            <UsageBar used={limits.usedUsers} max={limits.maxUsers} label="Utilisateurs" />
            <UsageBar used={limits.usedProducts} max={limits.maxProducts} label="Produits" />
            <UsageBar used={limits.usedLocations} max={limits.maxLocations} label="Emplacements" />
            <UsageBar
              used={limits.usedMovementsThisMonth}
              max={limits.maxMonthlyMovements}
              label="Mouvements ce mois"
            />
          </div>
        </div>
      )}
    </div>
  )
}
