import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptInvitation,
  createInvitation,
  declineInvitation,
  fetchInvitations,
  fetchMyInvitations,
  fetchMyOrganizations,
} from '../services/invitationService'

const INVITATIONS_QUERY_KEY = 'invitations'
const MY_ORGS_QUERY_KEY = 'my-organizations'
const MY_INVITATIONS_QUERY_KEY = 'my-invitations'

export function useInvitations() {
  return useQuery({
    queryKey: [INVITATIONS_QUERY_KEY],
    queryFn: fetchInvitations,
    staleTime: 30 * 1000,
  })
}

export function useMyOrganizations() {
  return useQuery({
    queryKey: [MY_ORGS_QUERY_KEY],
    queryFn: fetchMyOrganizations,
    staleTime: 30 * 1000,
  })
}

export function useMyInvitations() {
  return useQuery({
    queryKey: [MY_INVITATIONS_QUERY_KEY],
    queryFn: fetchMyInvitations,
    staleTime: 30 * 1000,
  })
}

export function useCreateInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INVITATIONS_QUERY_KEY] })
    },
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [MY_INVITATIONS_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [MY_ORGS_QUERY_KEY] })
    },
  })
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: declineInvitation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INVITATIONS_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [MY_INVITATIONS_QUERY_KEY] })
    },
  })
}
