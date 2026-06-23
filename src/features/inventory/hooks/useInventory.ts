import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useStock } from '@/features/stock/hooks/useStock'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { queueOperation } from '@/features/offline/services/queueService'
import {
  cacheInventorySessions,
  cacheInventoryCounts,
  getCachedInventorySessions,
  getCachedInventoryCounts,
  getCachedLocations,
  getCachedProducts,
} from '@/features/offline/services/cacheService'
import {
  applyInventorySession,
  createInventorySession,
  fetchInventorySessions,
  fetchSessionCounts,
  updateCount,
  type SessionWithDetails,
  type InventoryCountWithDetails,
} from '../services/inventoryService'

const INVENTORY_QUERY_KEY = 'inventory-sessions'

export function useInventorySessions() {
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.user.orgId

  return useQuery({
    queryKey: [INVENTORY_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      try {
        const data = await fetchInventorySessions(orgId)
        await cacheInventorySessions(data)
        return data
      } catch (err) {
        if (!online) {
          const [cached, locations] = await Promise.all([
            getCachedInventorySessions(orgId),
            getCachedLocations(orgId),
          ])

          if (cached.length > 0) {
            const locationMap = new Map(locations.map((l) => [l.id, l.name]))
            return cached.map(
              (s): SessionWithDetails => ({
                ...s,
                locationName: locationMap.get(s.locationId),
                operatorName: undefined,
              })
            )
          }
        }
        throw err
      }
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useSessionCounts(sessionId: string | null) {
  const online = useNetworkStatus()
  const { session } = useAuth()
  const orgId = session?.user.orgId

  return useQuery({
    queryKey: ['inventory-counts', sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error('Session manquante')
      try {
        const data = await fetchSessionCounts(sessionId)
        await cacheInventoryCounts(data)
        return data
      } catch (err) {
        if (!online && orgId) {
          const [cached, products] = await Promise.all([
            getCachedInventoryCounts().then((counts) =>
              counts.filter((c) => c.sessionId === sessionId)
            ),
            getCachedProducts(orgId),
          ])

          if (cached.length > 0) {
            const productMap = new Map(products.map((p) => [p.id, p.name]))
            const unitMap = new Map(products.map((p) => [p.id, p.unit]))
            return cached.map(
              (c): InventoryCountWithDetails => ({
                ...c,
                productName: productMap.get(c.productId),
                productUnit: unitMap.get(c.productId),
              })
            )
          }
        }
        throw err
      }
    },
    enabled: Boolean(sessionId),
    staleTime: 30 * 1000,
  })
}

export function useCreateInventorySession() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.user.orgId
  const operatorId = session?.user.id
  const { data: products } = useProducts()
  const { data: stock } = useStock()

  return useMutation({
    mutationFn: ({ locationId, name }: { locationId: string; name: string }) => {
      if (!orgId || !operatorId) throw new Error('Session invalide')
      if (!products) throw new Error('Produits non chargés')
      return createInventorySession(orgId, locationId, name, operatorId, products, stock ?? [])
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateCount(sessionId: string) {
  const queryClient = useQueryClient()
  const online = useNetworkStatus()

  return useMutation({
    mutationFn: ({ countId, countedQuantity }: { countId: string; countedQuantity: number }) => {
      if (!online) {
        return queueOperation({
          type: 'INVENTORY_COUNT_UPDATE',
          payload: { countId, countedQuantity },
        }).then(() => undefined)
      }
      return updateCount(countId, countedQuantity)
    },
    onMutate: async ({ countId, countedQuantity }) => {
      await queryClient.cancelQueries({ queryKey: ['inventory-counts', sessionId] })
      const previous = queryClient.getQueryData<InventoryCountWithDetails[]>([
        'inventory-counts',
        sessionId,
      ])

      queryClient.setQueryData(
        ['inventory-counts', sessionId],
        (old: InventoryCountWithDetails[] | undefined) => {
          if (!old) return old
          return old.map((c) =>
            c.id === countId
              ? {
                  ...c,
                  countedQuantity,
                  difference: countedQuantity - c.theoreticalQuantity,
                  isValidated: true,
                }
              : c
          )
        }
      )

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['inventory-counts', sessionId], context.previous)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory-counts', sessionId] })
    },
  })
}

export function useApplyInventorySession() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.user.orgId
  const online = useNetworkStatus()

  return useMutation({
    mutationFn: (sessionId: string) => {
      if (!online) {
        return queueOperation({ type: 'INVENTORY', payload: { sessionId } }).then(() => undefined)
      }
      return applyInventorySession(sessionId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY, orgId] })
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
      void queryClient.invalidateQueries({ queryKey: ['movements'] })
    },
  })
}
