import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { cacheContacts, getCachedContacts } from '@/features/offline/services/cacheService'
import { queueOperation } from '@/features/offline/services/queueService'
import { createContact, fetchContacts, updateContact } from '../services/contactService'
import type { Contact, ContactType } from '@/types'
import type { ContactFormData } from '../schemas/contactSchema'

const CONTACTS_QUERY_KEY = 'contacts'

export function useContacts(type?: ContactType) {
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [CONTACTS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      try {
        const data = await fetchContacts(orgId)
        await cacheContacts(data)
        return data
      } catch (err) {
        if (!online) {
          const cached = await getCachedContacts(orgId)
          if (cached.length > 0) return cached
        }
        throw err
      }
    },
    select: type ? (data) => data.filter((c) => c.type === type) : undefined,
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useCreateContact() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId
  const online = useNetworkStatus()
  const tempIdMap = useRef(new WeakMap<ContactFormData, string>())

  return useMutation({
    mutationFn: (input: ContactFormData) => {
      if (!orgId) throw new Error('Organisation manquante')
      const tempId = tempIdMap.current.get(input) ?? `pending-contact-${crypto.randomUUID()}`
      const inputWithTempId = { ...input, tempId }
      if (!online) {
        return queueOperation({
          type: 'CONTACT_CREATE',
          payload: { orgId, input: inputWithTempId },
        }).then(() => ({ tempId }))
      }
      return createContact(orgId, input)
        .then((created) => ({ ...created, tempId }))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Erreur réseau'
          return queueOperation({
            type: 'CONTACT_CREATE',
            payload: { orgId, input: inputWithTempId },
          }).then(() => ({ tempId, queued: true as const, error: message }))
        })
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: [CONTACTS_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Contact[]>([CONTACTS_QUERY_KEY, orgId])

      const tempId = `pending-contact-${crypto.randomUUID()}`
      tempIdMap.current.set(input, tempId)
      const optimistic: Contact = {
        id: tempId,
        orgId: orgId ?? '',
        type: input.type,
        name: input.name,
        email: input.email?.trim() ? input.email.trim() : null,
        phone: input.phone?.trim() ? input.phone.trim() : null,
        address: input.address?.trim() ? input.address.trim() : null,
        taxId: input.taxId?.trim() ? input.taxId.trim() : null,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        isActive: input.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      queryClient.setQueryData([CONTACTS_QUERY_KEY, orgId], (old: Contact[] | undefined) => {
        return [...(old ?? []), optimistic]
      })

      return { previous, tempId }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData([CONTACTS_QUERY_KEY, orgId], context.previous)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<ContactFormData>) => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { orgId, id, input }
      if (!online) {
        return queueOperation({ type: 'CONTACT_UPDATE', payload }).then(() => undefined)
      }
      return updateContact(id, orgId, input).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Erreur réseau'
        return queueOperation({ type: 'CONTACT_UPDATE', payload }).then(() => {
          const error = new Error(message)
          ;(error as Error & { queued?: boolean }).queued = true
          throw error
        })
      })
    },
    onMutate: async ({ id, ...input }) => {
      await queryClient.cancelQueries({ queryKey: [CONTACTS_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Contact[]>([CONTACTS_QUERY_KEY, orgId])

      queryClient.setQueryData([CONTACTS_QUERY_KEY, orgId], (old: Contact[] | undefined) => {
        if (!old) return old
        return old.map((c) => (c.id === id ? { ...c, ...input } : c))
      })

      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData([CONTACTS_QUERY_KEY, orgId], context.previous)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY, orgId] })
    },
  })
}
