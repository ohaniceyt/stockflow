import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { createUser, fetchTeamUsers, resetUserPin, updateUserActive } from '../services/teamService'

const TEAM_QUERY_KEY = 'team-users'

export function useTeamUsers() {
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [TEAM_QUERY_KEY, orgId],
    queryFn: () => fetchTeamUsers(),
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useUpdateUserActive() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

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
    mutationFn: ({ membershipId, newPin }: { membershipId: string; newPin: string }) =>
      resetUserPin(membershipId, newPin),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TEAM_QUERY_KEY, orgId] })
    },
  })
}
