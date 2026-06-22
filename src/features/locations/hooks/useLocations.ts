import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { fetchLocations } from '../services/locationService'

const LOCATIONS_QUERY_KEY = 'locations'

export function useLocations() {
  const { session } = useAuth()
  const orgId = session?.user.orgId

  return useQuery({
    queryKey: [LOCATIONS_QUERY_KEY, orgId],
    queryFn: () => {
      if (!orgId) throw new Error('Organisation manquante')
      return fetchLocations(orgId)
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}
