import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type CreateApiKeyInput,
} from '../services/apiKeyService'

const API_KEYS_QUERY_KEY = 'api-keys'

export function useApiKeys() {
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [API_KEYS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      return listApiKeys(orgId)
    },
    enabled: Boolean(orgId),
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: async (input: CreateApiKeyInput) => {
      if (!orgId) throw new Error('Organisation manquante')
      return createApiKey(orgId, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [API_KEYS_QUERY_KEY, orgId] })
    },
  })
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [API_KEYS_QUERY_KEY, orgId] })
    },
  })
}
