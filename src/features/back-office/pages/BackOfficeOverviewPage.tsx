import { useQuery } from '@tanstack/react-query'
import { Activity, Building2, MousePointerClick, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getOverview } from '../services/platformService'
import type { PlatformOverview } from '../types'

const OVERVIEW_QUERY_KEY = ['back-office', 'overview']

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-FR')
}

export default function BackOfficeOverviewPage() {
  const { data, isLoading, error } = useQuery<PlatformOverview>({
    queryKey: OVERVIEW_QUERY_KEY,
    queryFn: getOverview,
  })

  const stats = data ?? {
    organizationsTotal: 0,
    organizationsActive: 0,
    usersTotal: 0,
    usersOnline: 0,
    movementsToday: 0,
    subscriptionsByPlan: {},
    recentActivity: [],
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vue d'ensemble</h1>
        <p className="text-muted-foreground">Activité globale de la plateforme en temps réel.</p>
      </div>

      {error && <p className="text-destructive">{error.message}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Organisations"
          value={stats.organizationsTotal}
          icon={Building2}
          loading={isLoading}
        />
        <StatCard
          label="Organisations actives"
          value={stats.organizationsActive}
          icon={Building2}
          loading={isLoading}
        />
        <StatCard label="Utilisateurs" value={stats.usersTotal} icon={Users} loading={isLoading} />
        <StatCard
          label="Utilisateurs en ligne"
          value={stats.usersOnline}
          icon={Activity}
          loading={isLoading}
        />
        <StatCard
          label="Mouvements aujourd'hui"
          value={stats.movementsToday}
          icon={MousePointerClick}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Répartition des plans</h2>
          <div className="mt-4 space-y-2">
            {Object.entries(stats.subscriptionsByPlan).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée.</p>
            ) : (
              Object.entries(stats.subscriptionsByPlan).map(([plan, count]) => (
                <div key={plan} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{plan}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="font-semibold">Activité récente</h2>
          <div className="mt-4 space-y-3">
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune action récente.</p>
            ) : (
              stats.recentActivity.slice(0, 10).map((log) => (
                <div key={log.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{log.action}</Badge>
                    <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {log.actorRole ?? '—'} → {log.targetType ?? '—'}:{log.targetId ?? '—'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string
  value: number
  icon: React.ElementType
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{loading ? '…' : value}</p>
    </div>
  )
}
