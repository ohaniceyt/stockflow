import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { cacheProducts, getCachedProducts } from '@/features/offline/services/cacheService'
import { queueOperation } from '@/features/offline/services/queueService'
import { createProduct, fetchProducts, updateProduct } from '../services/productService'
import type { Product } from '@/types'

const PRODUCTS_QUERY_KEY = 'products'

export function useProducts() {
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      try {
        const data = await fetchProducts(orgId)
        await cacheProducts(data)
        return data
      } catch (err) {
        if (!online) {
          const cached = await getCachedProducts(orgId)
          if (cached.length > 0) return cached
        }
        throw err
      }
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId
  const online = useNetworkStatus()

  return useMutation({
    mutationFn: (input: Omit<Product, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => {
      if (!orgId) throw new Error('Organisation manquante')
      if (!online) {
        return queueOperation({ type: 'PRODUCT_CREATE', payload: { orgId, input } }).then(
          () => undefined
        )
      }
      return createProduct(orgId, input)
    },
    onMutate: async (input) => {
      if (online) return
      await queryClient.cancelQueries({ queryKey: [PRODUCTS_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Product[]>([PRODUCTS_QUERY_KEY, orgId])

      const optimistic: Product = {
        id: `pending-${crypto.randomUUID()}`,
        orgId: orgId ?? '',
        name: input.name,
        category: input.category ?? null,
        unit: input.unit,
        threshold: input.threshold,
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        supplier: input.supplier ?? null,
        description: input.description ?? null,
        barcode: input.barcode ?? null,
        isActive: input.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      queryClient.setQueryData([PRODUCTS_QUERY_KEY, orgId], (old: Product[] | undefined) => {
        return [...(old ?? []), optimistic]
      })

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData([PRODUCTS_QUERY_KEY, orgId], context.previous)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId

  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & Partial<Omit<Product, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>) => {
      if (!online) {
        return queueOperation({ type: 'PRODUCT_UPDATE', payload: { id, input } }).then(
          () => undefined
        )
      }
      return updateProduct(id, input)
    },
    onMutate: async ({ id, ...input }) => {
      await queryClient.cancelQueries({ queryKey: [PRODUCTS_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Product[]>([PRODUCTS_QUERY_KEY, orgId])

      queryClient.setQueryData([PRODUCTS_QUERY_KEY, orgId], (old: Product[] | undefined) => {
        if (!old) return old
        return old.map((p) => (p.id === id ? { ...p, ...input } : p))
      })

      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData([PRODUCTS_QUERY_KEY, orgId], context.previous)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY, orgId] })
    },
  })
}
