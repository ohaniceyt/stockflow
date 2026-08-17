import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  fetchSessionSales,
  type MovementWithDetails,
} from '@/features/movements/services/movementService'

export const SESSION_SALES_KEY = 'session-sales'

/**
 * All non-cancelled OUT movements for a cashier session, untruncated.
 * Replaces the previous derivation from `useMovements()` (paginated 25/page,
 * never paged forward on the cashier page) which corrupted `dailyRevenue` and
 * truncated the sales list once a session exceeded 25 sales.
 */
export function useSessionSales(sessionId: string | null | undefined) {
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useQuery<MovementWithDetails[]>({
    queryKey: [SESSION_SALES_KEY, sessionId ?? ''],
    queryFn: () => {
      if (!orgId) throw new Error('Entreprise manquante')
      if (!sessionId) return []
      return fetchSessionSales(orgId, sessionId)
    },
    enabled: Boolean(orgId) && Boolean(sessionId),
    staleTime: 15 * 1000,
  })
}
