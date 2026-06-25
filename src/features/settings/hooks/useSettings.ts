import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { fetchCurrentUser, updateCurrentUserProfile } from '../services/userService'
import { fetchOrganization, updateOrganization } from '../services/organizationService'

const PROFILE_QUERY_KEY = 'current-user-profile'
const ORGANIZATION_QUERY_KEY = 'current-organization'

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: [PROFILE_QUERY_KEY],
    queryFn: fetchCurrentUser,
    staleTime: 30 * 1000,
  })
}

export function useUpdateCurrentUserProfile() {
  const queryClient = useQueryClient()
  const { session, persistSession } = useAuth()

  return useMutation({
    mutationFn: updateCurrentUserProfile,
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] })
      if (session) {
        persistSession({ ...session, user: { ...session.user, name: user.name, phone: user.phone } })
      }
    },
  })
}

export function useOrganization() {
  const { session } = useAuth()
  const orgId = session?.membership.orgId
  const online = useNetworkStatus()

  return useQuery({
    queryKey: [ORGANIZATION_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      return fetchOrganization(orgId)
    },
    enabled: Boolean(orgId) && online,
    staleTime: 30 * 1000,
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  const { session, persistSession } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: async (input: Parameters<typeof updateOrganization>[1]) => {
      if (!orgId) throw new Error('Organisation manquante')
      return updateOrganization(orgId, input)
    },
    onSuccess: (organization) => {
      void queryClient.invalidateQueries({ queryKey: [ORGANIZATION_QUERY_KEY, orgId] })
      if (session) {
        persistSession({ ...session, organization })
      }
    },
  })
}
