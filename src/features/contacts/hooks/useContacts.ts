import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { cacheContacts, getCachedContacts } from '@/features/offline/services/cacheService'
import {
  createContact,
  deleteContact,
  fetchContacts,
  updateContact,
} from '../services/contactService'
import type { ContactType } from '@/types'
import type { ContactFormData } from '../schemas/contactSchema'

const CONTACTS_QUERY_KEY = 'contacts'

export function useContacts(type?: ContactType) {
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [CONTACTS_QUERY_KEY, orgId, type],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      try {
        const data = await fetchContacts(orgId)
        await cacheContacts(data)
        return type ? data.filter((c) => c.type === type) : data
      } catch (err) {
        if (!online) {
          const cached = await getCachedContacts(orgId)
          const filtered = type ? cached.filter((c) => c.type === type) : cached
          if (filtered.length > 0) return filtered
        }
        throw err
      }
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useCreateContact() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: (input: ContactFormData) => {
      if (!orgId) throw new Error('Organisation manquante')
      return createContact(orgId, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<ContactFormData>) => {
      return updateContact(id, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY, orgId] })
    },
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY, orgId] })
    },
  })
}
