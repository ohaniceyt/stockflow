import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import {
  cacheMovements,
  getCachedMovements,
  getCachedProducts,
  getCachedLocations,
} from '@/features/offline/services/cacheService'
import { queueOperation } from '@/features/offline/services/queueService'
import {
  createMovement,
  fetchMovements,
  type MovementWithDetails,
} from '../services/movementService'

const MOVEMENTS_QUERY_KEY = 'movements'

export function useMovements() {
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.user.orgId

  return useQuery({
    queryKey: [MOVEMENTS_QUERY_KEY],
    queryFn: async () => {
      try {
        const data = await fetchMovements()
        await cacheMovements(data)
        return data
      } catch (err) {
        if (!online && orgId) {
          const [cached, products, locations] = await Promise.all([
            getCachedMovements(),
            getCachedProducts(orgId),
            getCachedLocations(orgId),
          ])

          if (cached.length > 0) {
            const productMap = new Map(products.map((p) => [p.id, p.name]))
            const locationMap = new Map(locations.map((l) => [l.id, l.name]))

            return cached.map(
              (m): MovementWithDetails => ({
                ...m,
                productName: productMap.get(m.productId),
                locationName: locationMap.get(m.locationId),
                targetLocationName: m.targetLocationId
                  ? locationMap.get(m.targetLocationId)
                  : undefined,
                operatorName: undefined,
              })
            )
          }
        }
        throw err
      }
    },
    staleTime: 30 * 1000,
  })
}

export function useCreateMovement() {
  const queryClient = useQueryClient()
  const online = useNetworkStatus()

  return useMutation({
    mutationFn: (input: Parameters<typeof createMovement>[0]) => {
      if (!online) {
        return queueOperation({ type: 'MOVEMENT', payload: input }).then(() => undefined)
      }
      return createMovement(input)
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: [MOVEMENTS_QUERY_KEY] })
      const previous = queryClient.getQueryData<MovementWithDetails[]>([MOVEMENTS_QUERY_KEY])

      const optimistic: MovementWithDetails = {
        id: `pending-${crypto.randomUUID()}`,
        productId: input.productId,
        locationId: input.locationId,
        targetLocationId: input.targetLocationId ?? null,
        type: input.type,
        quantity: input.quantity,
        stockBefore: 0,
        stockAfter: 0,
        reason: input.reason ?? null,
        operatorId: '',
        referenceId: null,
        createdAt: new Date().toISOString(),
        productName: undefined,
        locationName: undefined,
        targetLocationName: undefined,
        operatorName: undefined,
      }

      queryClient.setQueryData([MOVEMENTS_QUERY_KEY], (old: MovementWithDetails[] | undefined) => {
        return [optimistic, ...(old ?? [])]
      })

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData([MOVEMENTS_QUERY_KEY], context.previous)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [MOVEMENTS_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}
