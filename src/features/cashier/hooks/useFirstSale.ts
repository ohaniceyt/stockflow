import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { fetchHasCashierSale } from '@/features/dashboard/services/dashboardService'

const HAS_CASHIER_SALE_KEY = 'has-cashier-sale'

/**
 * Whether the org has ever recorded a non-cancelled cashier sale. Server-side
 * (not capped at the recent-movements page) so an aged first sale past page 1
 * no longer re-triggers the cashier onboarding.
 */
export function useFirstSale() {
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  const { isLoading, data } = useQuery<boolean>({
    queryKey: [HAS_CASHIER_SALE_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Entreprise manquante')
      return fetchHasCashierSale(orgId)
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })

  return {
    isLoading,
    isFirstSale: !isLoading && !data,
  }
}
