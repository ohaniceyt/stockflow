import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { db } from '@/lib/db'
import { queueOperation } from '@/features/offline/services/queueService'
import { cacheLocations, getCachedLocations } from '@/features/offline/services/cacheService'
import {
  createLocation,
  fetchLocations,
  setDefaultLocation,
  updateLocation,
} from '../services/locationService'
import type { LocationFormData } from '../schemas/locationSchema'
import type { Location } from '@/types'

const LOCATIONS_QUERY_KEY = 'locations'

export function useLocations() {
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [LOCATIONS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      try {
        const data = await fetchLocations(orgId)
        await cacheLocations(data)
        return data
      } catch (err) {
        if (!online) {
          const cached = await getCachedLocations(orgId)
          if (cached.length > 0) return cached
        }
        throw err
      }
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useCreateLocation() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: async (input: LocationFormData): Promise<void> => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { orgId, input }
      if (!online) {
        await queueOperation({ type: 'LOCATION_CREATE', payload })
        return
      }
      try {
        await createLocation(orgId, input)
      } catch {
        await queueOperation({ type: 'LOCATION_CREATE', payload })
      }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: [LOCATIONS_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Location[]>([LOCATIONS_QUERY_KEY, orgId])
      const optimistic: Location = {
        id: `pending-location-${crypto.randomUUID()}`,
        orgId: orgId ?? '',
        name: input.name,
        description: input.description ?? null,
        address: input.address ?? null,
        isDefault: false,
        createdAt: new Date().toISOString(),
      }
      queryClient.setQueryData([LOCATIONS_QUERY_KEY, orgId], (old: Location[] | undefined) => {
        return [...(old ?? []), optimistic]
      })
      try {
        await db.locations.put(optimistic)
      } catch (err) {
        console.error('Failed to cache optimistic location', err)
      }
      return { previous, optimisticId: optimistic.id }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData([LOCATIONS_QUERY_KEY, orgId], context.previous)
      }
      if (context?.optimisticId) {
        void db.locations.delete(context.optimisticId)
      }
    },
    onSuccess: (_data, _input, context) => {
      if (context.optimisticId) {
        void db.locations.delete(context.optimisticId)
      }
      void queryClient.invalidateQueries({ queryKey: [LOCATIONS_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateLocation() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & LocationFormData): Promise<void> => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { orgId, id, input }
      if (!online) {
        await queueOperation({ type: 'LOCATION_UPDATE', payload })
        return
      }
      try {
        await updateLocation(id, orgId, input)
      } catch {
        await queueOperation({ type: 'LOCATION_UPDATE', payload })
      }
    },
    onMutate: async ({ id, ...input }) => {
      await queryClient.cancelQueries({ queryKey: [LOCATIONS_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Location[]>([LOCATIONS_QUERY_KEY, orgId])

      queryClient.setQueryData([LOCATIONS_QUERY_KEY, orgId], (old: Location[] | undefined) => {
        if (!old) return old
        return old.map((l) =>
          l.id === id
            ? {
                ...l,
                name: input.name,
                description: input.description ?? null,
                address: input.address ?? null,
              }
            : l
        )
      })

      if (previous) {
        const updated = previous.find((l) => l.id === id)
        if (updated) {
          try {
            await db.locations.put({
              ...updated,
              name: input.name,
              description: input.description ?? null,
              address: input.address ?? null,
            })
          } catch (err) {
            console.error('Failed to cache location update', err)
          }
        }
      }

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData([LOCATIONS_QUERY_KEY, orgId], context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [LOCATIONS_QUERY_KEY, orgId] })
    },
  })
}

export function useSetDefaultLocation() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { id, orgId }
      if (!online) {
        await queueOperation({ type: 'LOCATION_SET_DEFAULT', payload })
        return
      }
      try {
        await setDefaultLocation(id, orgId)
      } catch {
        await queueOperation({ type: 'LOCATION_SET_DEFAULT', payload })
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [LOCATIONS_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Location[]>([LOCATIONS_QUERY_KEY, orgId])

      queryClient.setQueryData([LOCATIONS_QUERY_KEY, orgId], (old: Location[] | undefined) => {
        if (!old) return old
        return old.map((l) => ({ ...l, isDefault: l.id === id }))
      })

      if (previous) {
        try {
          await db.locations.bulkPut(previous.map((l) => ({ ...l, isDefault: l.id === id })))
        } catch (err) {
          console.error('Failed to cache default location update', err)
        }
      }

      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData([LOCATIONS_QUERY_KEY, orgId], context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [LOCATIONS_QUERY_KEY, orgId] })
    },
  })
}
