import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { cacheProducts, getCachedProducts } from '@/features/offline/services/cacheService'
import { queueOperation } from '@/features/offline/services/queueService'
import { createProduct, fetchProducts, updateProduct } from '../services/productService'
import type { Product } from '@/types'

const PRODUCTS_QUERY_KEY = 'products'

export type CreateProductInput = Omit<Product, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>

type CreateProductResult =
  | (Product & { tempId: string; queued: false })
  | { tempId: string; queued: true; error?: string }

interface CreateProductContext {
  previous: Product[] | undefined
  tempId: string
}

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
  // Share the generated tempId between onMutate and mutationFn without a
  // mutable instance ref, so concurrent creates keep distinct optimistic IDs.
  const tempIdMap = useRef(new WeakMap<CreateProductInput, string>())

  return useMutation<CreateProductResult, Error, CreateProductInput, CreateProductContext>({
    mutationFn: (input) => {
      if (!orgId) throw new Error('Organisation manquante')
      const tempId = tempIdMap.current.get(input) ?? `pending-${crypto.randomUUID()}`
      const inputWithTempId = { ...input, tempId }
      if (!online) {
        return queueOperation({
          type: 'PRODUCT_CREATE',
          payload: { orgId, input: inputWithTempId },
        }).then(() => ({ tempId, queued: true as const }))
      }
      return createProduct(orgId, inputWithTempId)
        .then((created) => ({ ...created, tempId, queued: false as const }))
        .catch((err: unknown) => {
          // Fall back to queueing if the online request failed (transient or recoverable).
          const message = err instanceof Error ? err.message : 'Erreur réseau'
          return queueOperation({
            type: 'PRODUCT_CREATE',
            payload: { orgId, input: inputWithTempId },
          }).then(() => ({ tempId, queued: true as const, error: message }))
        })
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: [PRODUCTS_QUERY_KEY, orgId] })
      const previous = queryClient.getQueryData<Product[]>([PRODUCTS_QUERY_KEY, orgId])

      const tempId = `pending-${crypto.randomUUID()}`
      tempIdMap.current.set(input, tempId)
      const optimistic: Product = {
        id: tempId,
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

      return { previous, tempId }
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
    mutationFn: ({ id, ...input }: { id: string } & Partial<CreateProductInput>) => {
      if (!orgId) throw new Error('Organisation manquante')
      const payload = { orgId, id, input }
      if (!online) {
        return queueOperation({ type: 'PRODUCT_UPDATE', payload }).then(() => undefined)
      }
      return updateProduct(id, orgId, input).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Erreur réseau'
        return queueOperation({ type: 'PRODUCT_UPDATE', payload }).then(() => {
          const error = new Error(message)
          ;(error as Error & { queued?: boolean }).queued = true
          throw error
        })
      })
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
