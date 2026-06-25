import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
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
  const orgId = session?.membership.orgId

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
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: ['inventory-counts', sessionId],
    queryFn: async () => {
      if (!sessionId || !orgId) throw new Error('Session manquante')
      try {
        const data = await fetchSessionCounts(sessionId, orgId)
        await cacheInventoryCounts(data)
        return data
      } catch (err) {
        if (!online && orgId) {
          const [cached, products] = await Promise.all([
            getCachedInventoryCounts(orgId).then((counts) =>
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
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId
  const operatorId = session?.user.id

  return useMutation({
    mutationFn: async ({
      locationId,
      name,
    }: {
      locationId: string
      name: string
    }): Promise<void> => {
      if (!orgId || !operatorId) throw new Error('Session invalide')
      const payload = { orgId, locationId, name, operatorId }
      if (!online) {
        await queueOperation({ type: 'INVENTORY_SESSION_CREATE', payload })
        return
      }
      try {
        await createInventorySession(orgId, locationId, name, operatorId)
      } catch {
        await queueOperation({ type: 'INVENTORY_SESSION_CREATE', payload })
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateCount(sessionId: string) {
  const queryClient = useQueryClient()
  const online = useNetworkStatus()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: async ({
      countId,
      countedQuantity,
    }: {
      countId: string
      countedQuantity: number
    }): Promise<void> => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { orgId, countId, countedQuantity }
      if (!online) {
        await queueOperation({
          type: 'INVENTORY_COUNT_UPDATE',
          payload,
        })
        return
      }
      try {
        await updateCount(countId, countedQuantity)
      } catch {
        await queueOperation({
          type: 'INVENTORY_COUNT_UPDATE',
          payload,
        })
      }
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
  const orgId = session?.membership.orgId
  const online = useNetworkStatus()

  return useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { orgId, sessionId }
      if (!online) {
        await queueOperation({ type: 'INVENTORY', payload })
        return
      }
      try {
        await applyInventorySession(sessionId)
      } catch {
        await queueOperation({ type: 'INVENTORY', payload })
      }
    },
    onSuccess: (_data, sessionId) => {
      void queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY, orgId] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-counts', sessionId] })
      void queryClient.invalidateQueries({ queryKey: ['stock', orgId] })
      void queryClient.invalidateQueries({ queryKey: ['movements', orgId] })
    },
  })
}
