import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { cacheCategories, getCachedCategories } from '@/features/offline/services/cacheService'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from '../services/categoryService'

const CATEGORIES_QUERY_KEY = 'categories'

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
    mutationFn: (name: string) => {
      if (!orgId) throw new Error('Organisation manquante')
      if (!online) throw new Error('Une connexion est requise pour créer une catégorie')
      return createCategory(orgId, name)
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
      if (!online) throw new Error('Une connexion est requise pour modifier une catégorie')
      return updateCategory(id, name)
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
      if (!online) throw new Error('Une connexion est requise pour supprimer une catégorie')
      return deleteCategory(id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CATEGORIES_QUERY_KEY, orgId] })
    },
  })
}
