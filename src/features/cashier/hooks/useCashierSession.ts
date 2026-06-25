import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { closeSession, fetchOpenSession, openSession } from '../services/cashierService'

const CASHIER_SESSION_QUERY_KEY = 'cashier-session'

export function useCashierSession(locationId: string) {
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [CASHIER_SESSION_QUERY_KEY, orgId, locationId],
    queryFn: async () => {
      if (!orgId || !locationId) return null
      if (!online) return null
      return fetchOpenSession(orgId, locationId)
    },
    enabled: Boolean(orgId && locationId && online),
    staleTime: 10 * 1000,
  })
}

export function useOpenCashierSession() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId
  const operatorId = session?.user.id

  return useMutation({
    mutationFn: async (input: { locationId: string; openingBalance: number }) => {
      if (!orgId || !operatorId) throw new Error('Session manquante')
      if (!online) throw new Error('Une connexion est requise pour ouvrir une caisse')
      return openSession({
        orgId,
        locationId: input.locationId,
        operatorId,
        openingBalance: input.openingBalance,
      })
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: [CASHIER_SESSION_QUERY_KEY, orgId, input.locationId],
      })
    },
  })
}

export function useCloseCashierSession() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: async (input: {
      sessionId: string
      locationId: string
      closingBalance: number
      dailyRevenue: number
    }) => {
      return closeSession({
        sessionId: input.sessionId,
        closingBalance: input.closingBalance,
        dailyRevenue: input.dailyRevenue,
      })
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: [CASHIER_SESSION_QUERY_KEY, orgId, input.locationId],
      })
    },
  })
}
