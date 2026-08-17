import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  fetchMovementStats,
  type MovementStatsRange,
  type MovementStatsResult,
} from '../services/dashboardService'

export const MOVEMENT_STATS_KEY = 'movement-stats'

/**
 * Server-aggregated movement stats for a given org and half-open date range
 * `[from, to)` (NULL = unbounded). Replaces the old client-side aggregation over
 * `useMovements` that was silently capped at the 25 most-recent movements.
 */
export function useMovementStats(range: MovementStatsRange) {
  const { session } = useAuth()
  const orgId = session?.membership.orgId
  const rangeKey = `${range.from ?? 'null'}|${range.to ?? 'null'}`

  return useQuery<MovementStatsResult>({
    queryKey: [MOVEMENT_STATS_KEY, orgId, rangeKey],
    queryFn: async () => {
      if (!orgId) throw new Error('Entreprise manquante')
      return fetchMovementStats(orgId, range)
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}
