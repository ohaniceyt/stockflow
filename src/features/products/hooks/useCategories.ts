import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { cacheCategories, getCachedCategories } from '@/features/offline/services/cacheService'
import { queueOperation } from '@/features/offline/services/queueService'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from '../services/categoryService'
import type { Category } from '@/types'

export const CATEGORIES_QUERY_KEY = 'categories'

export function useCategories() {
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [CATEGORIES_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      try {
        const data = await fetchCategories(orgId)
        await cacheCategories(data)
        return data
      } catch (err) {
        if (!online) {
          const cached = await getCachedCategories(orgId)
          if (cached.length > 0) return cached
        }
        throw err
      }
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: async (name: string): Promise<Category> => {
      if (!orgId) throw new Error('Organisation manquante')
      if (!online) {
        throw new Error('Création de catégorie indisponible hors ligne')
      }
      try {
        return await createCategory(orgId, name)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur réseau'
        return queueOperation({
          type: 'CATEGORY_CREATE',
          payload: { orgId, name },
        }).then(() => {
          const error = new Error(message)
          ;(error as Error & { queued?: boolean }).queued = true
          throw error
        })
      }
    },
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: [CATEGORIES_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Category[]>([CATEGORIES_QUERY_KEY, orgId])

      const optimistic: Category = {
        id: `pending-category-${crypto.randomUUID()}`,
        orgId: orgId ?? '',
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      queryClient.setQueryData([CATEGORIES_QUERY_KEY, orgId], (old: Category[] | undefined) => {
        return [...(old ?? []), optimistic]
      })

      return { previous }
    },
    onError: (_err, _name, context) => {
      if (context?.previous) {
        queryClient.setQueryData([CATEGORIES_QUERY_KEY, orgId], context.previous)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CATEGORIES_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { orgId, id, name }
      if (!online) {
        return queueOperation({ type: 'CATEGORY_UPDATE', payload }).then(() => undefined)
      }
      return updateCategory(id, orgId, name).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Erreur réseau'
        return queueOperation({ type: 'CATEGORY_UPDATE', payload }).then(() => {
          const error = new Error(message)
          ;(error as Error & { queued?: boolean }).queued = true
          throw error
        })
      })
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: [CATEGORIES_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Category[]>([CATEGORIES_QUERY_KEY, orgId])

      queryClient.setQueryData([CATEGORIES_QUERY_KEY, orgId], (old: Category[] | undefined) => {
        if (!old) return old
        return old.map((c) => (c.id === id ? { ...c, name } : c))
      })

      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData([CATEGORIES_QUERY_KEY, orgId], context.previous)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CATEGORIES_QUERY_KEY, orgId] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: (id: string) => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { orgId, id }
      if (!online) {
        return queueOperation({ type: 'CATEGORY_DELETE', payload }).then(() => undefined)
      }
      return deleteCategory(id, orgId).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Erreur réseau'
        return queueOperation({ type: 'CATEGORY_DELETE', payload }).then(() => {
          const error = new Error(message)
          ;(error as Error & { queued?: boolean }).queued = true
          throw error
        })
      })
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [CATEGORIES_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Category[]>([CATEGORIES_QUERY_KEY, orgId])

      queryClient.setQueryData([CATEGORIES_QUERY_KEY, orgId], (old: Category[] | undefined) => {
        if (!old) return old
        return old.filter((c) => c.id !== id)
      })

      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData([CATEGORIES_QUERY_KEY, orgId], context.previous)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CATEGORIES_QUERY_KEY, orgId] })
    },
  })
}
