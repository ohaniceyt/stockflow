import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { cacheLocations, getCachedLocations } from '@/features/offline/services/cacheService'
import {
  createLocation,
  fetchLocations,
  setDefaultLocation,
  updateLocation,
} from '../services/locationService'
import type { LocationFormData } from '../schemas/locationSchema'

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
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: (input: LocationFormData) => {
      if (!orgId) throw new Error('Organisation manquante')
      return createLocation(orgId, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [LOCATIONS_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateLocation() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & LocationFormData) => {
      return updateLocation(id, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [LOCATIONS_QUERY_KEY, orgId] })
    },
  })
}

export function useSetDefaultLocation() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: (id: string) => {
      if (!orgId) throw new Error('Organisation manquante')
      return setDefaultLocation(id, orgId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [LOCATIONS_QUERY_KEY, orgId] })
    },
  })
}
