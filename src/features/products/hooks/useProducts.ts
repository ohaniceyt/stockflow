import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { createProduct, fetchProducts, updateProduct } from '../services/productService'
import type { Product } from '@/types'

const PRODUCTS_QUERY_KEY = 'products'

export function useProducts() {
  const { session } = useAuth()
  const orgId = session?.user.orgId

  return useQuery({
    queryKey: [PRODUCTS_QUERY_KEY, orgId],
    queryFn: () => {
      if (!orgId) throw new Error('Organisation manquante')
      return fetchProducts(orgId)
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.user.orgId

  return useMutation({
    mutationFn: (input: Omit<Product, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => {
      if (!orgId) throw new Error('Organisation manquante')
      return createProduct(orgId, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.user.orgId

  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & Partial<Omit<Product, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>) => {
      return updateProduct(id, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY, orgId] })
    },
  })
}
