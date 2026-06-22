import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { fetchTeamUsers, resetUserPin, updateUserActive } from '../services/teamService'

const TEAM_QUERY_KEY = 'team-users'

export function useTeamUsers() {
  const { session } = useAuth()
  const orgId = session?.user.orgId

  return useQuery({
    queryKey: [TEAM_QUERY_KEY, orgId],
    queryFn: () => {
      if (!orgId) throw new Error('Organisation manquante')
      return fetchTeamUsers(orgId)
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useUpdateUserActive() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.user.orgId

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUserActive(id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TEAM_QUERY_KEY, orgId] })
    },
  })
}

export function useResetUserPin() {
  return useMutation({
    mutationFn: ({ userId, newPin }: { userId: string; newPin: string }) =>
      resetUserPin(userId, newPin),
  })
}
