import { useQuery } from '@tanstack/react-query'
import { Activity, Building2, MousePointerClick, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PageHeader, PageSection, DataCard, EmptyState } from '@/components/design-system'
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
      <PageHeader
        title="Vue d'ensemble"
        description="Activité globale de la plateforme en temps réel."
      />

      {error && <p className="text-destructive">{error.message}</p>}

      <PageSection>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DataCard
            label="Organisations"
            value={isLoading ? '…' : stats.organizationsTotal}
            icon={Building2}
          />
          <DataCard
            label="Organisations actives"
            value={isLoading ? '…' : stats.organizationsActive}
            icon={Building2}
            status="success"
          />
          <DataCard label="Utilisateurs" value={isLoading ? '…' : stats.usersTotal} icon={Users} />
          <DataCard
            label="Utilisateurs en ligne"
            value={isLoading ? '…' : stats.usersOnline}
            icon={Activity}
            status="info"
          />
          <DataCard
            label="Mouvements aujourd'hui"
            value={isLoading ? '…' : stats.movementsToday}
            icon={MousePointerClick}
          />
        </div>
      </PageSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <PageSection title="Répartition des plans">
          <div className="space-y-2">
            {Object.entries(stats.subscriptionsByPlan).length === 0 ? (
              <EmptyState
                title="Aucune donnée"
                description="Les statistiques de plans apparaîtront ici."
                className="border-0 bg-transparent shadow-none"
              />
            ) : (
              Object.entries(stats.subscriptionsByPlan).map(([plan, count]) => (
                <div key={plan} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{plan}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))
            )}
          </div>
        </PageSection>

        <PageSection title="Activité récente">
          <div className="space-y-3">
            {stats.recentActivity.length === 0 ? (
              <EmptyState
                title="Aucune action récente"
                description="L'activité des administrateurs apparaîtra ici."
                className="border-0 bg-transparent shadow-none"
              />
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
        </PageSection>
      </div>
    </div>
  )
}
