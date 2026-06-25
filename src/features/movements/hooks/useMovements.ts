import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { db } from '@/lib/db'
import {
  cacheContacts,
  cacheMovements,
  getCachedContacts,
  getCachedLocations,
  getCachedMovements,
  getCachedProducts,
} from '@/features/offline/services/cacheService'
import { queueOperation } from '@/features/offline/services/queueService'
import {
  createMovement,
  fetchMovements,
  type MovementWithDetails,
} from '../services/movementService'
import { fetchContacts } from '@/features/contacts/services/contactService'
import type { StockItem } from '@/features/stock/services/stockService'

const MOVEMENTS_QUERY_KEY = 'movements'

export function useMovements() {
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [MOVEMENTS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      try {
        const data = await fetchMovements(orgId)
        await cacheMovements(data)
        const contacts = await fetchContacts(orgId)
        await cacheContacts(contacts)
        return data
      } catch (err) {
        if (!online) {
          const [cached, products, locations, contacts] = await Promise.all([
            getCachedMovements(orgId),
            getCachedProducts(orgId),
            getCachedLocations(orgId),
            getCachedContacts(orgId),
          ])

          if (cached.length > 0) {
            const productMap = new Map(products.map((p) => [p.id, p.name]))
            const locationMap = new Map(locations.map((l) => [l.id, l.name]))
            const contactMap = new Map(contacts.map((c) => [c.id, c.name]))

            return cached.map(
              (m): MovementWithDetails => ({
                ...m,
                productName: productMap.get(m.productId),
                locationName: locationMap.get(m.locationId),
                targetLocationName: m.targetLocationId
                  ? locationMap.get(m.targetLocationId)
                  : undefined,
                operatorName: undefined,
                contactName: m.contactId ? contactMap.get(m.contactId) : undefined,
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

export function useCreateMovement() {
  const queryClient = useQueryClient()
  const online = useNetworkStatus()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: async (
      input: Omit<Parameters<typeof createMovement>[0], 'orgId'>
    ): Promise<void> => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { ...input, orgId }
      if (!online) {
        await queueOperation({ type: 'MOVEMENT', payload })
        return
      }
      try {
        await createMovement(payload)
      } catch {
        await queueOperation({ type: 'MOVEMENT', payload })
      }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: [MOVEMENTS_QUERY_KEY, orgId] })
      const previousMovements = queryClient.getQueryData<MovementWithDetails[]>([
        MOVEMENTS_QUERY_KEY,
        orgId,
      ])
      const previousStock = queryClient.getQueryData<StockItem[]>(['stock', orgId])

      // Compute realistic stock before/after from the current stock cache.
      const stockBefore =
        previousStock?.find(
          (item) => item.productId === input.productId && item.locationId === input.locationId
        )?.quantity ?? 0
      let stockAfter = stockBefore
      if (input.type === 'IN') stockAfter += input.quantity
      if (input.type === 'OUT') stockAfter -= input.quantity
      if (input.type === 'ADJUSTMENT') stockAfter = input.quantity

      const optimistic: MovementWithDetails = {
        id: `pending-${crypto.randomUUID()}`,
        orgId: orgId ?? '',
        productId: input.productId,
        locationId: input.locationId,
        targetLocationId: input.targetLocationId ?? null,
        type: input.type,
        quantity: input.quantity,
        stockBefore: Math.max(0, stockBefore),
        stockAfter: Math.max(0, stockAfter),
        reason: input.reason ?? null,
        contactId: input.contactId ?? null,
        operatorId: session?.user.id ?? '',
        referenceId: null,
        createdAt: new Date().toISOString(),
        productName: undefined,
        locationName: undefined,
        targetLocationName: undefined,
        operatorName: undefined,
        contactName: undefined,
      }

      queryClient.setQueryData(
        [MOVEMENTS_QUERY_KEY, orgId],
        (old: MovementWithDetails[] | undefined) => {
          return [optimistic, ...(old ?? [])]
        }
      )

      try {
        await db.movements.put(optimistic)
      } catch (err) {
        console.error('Failed to cache optimistic movement', err)
      }

      return { previousMovements, optimisticId: optimistic.id }
    },
    onError: (_err, _input, context) => {
      if (context?.previousMovements) {
        queryClient.setQueryData([MOVEMENTS_QUERY_KEY, orgId], context.previousMovements)
      }
      if (context?.optimisticId) {
        void db.movements.delete(context.optimisticId)
      }
    },
    onSuccess: (_data, _input, context) => {
      if (context.optimisticId) {
        void db.movements.delete(context.optimisticId)
      }
      void queryClient.invalidateQueries({ queryKey: [MOVEMENTS_QUERY_KEY, orgId] })
      void queryClient.invalidateQueries({ queryKey: ['stock', orgId] })
    },
  })
}
