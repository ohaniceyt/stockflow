import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useStock } from '@/features/stock/hooks/useStock'
import {
  applyInventorySession,
  createInventorySession,
  fetchInventorySessions,
  fetchSessionCounts,
  updateCount,
} from '../services/inventoryService'

const INVENTORY_QUERY_KEY = 'inventory-sessions'

export function useInventorySessions() {
  const { session } = useAuth()
  const orgId = session?.user.orgId

  return useQuery({
    queryKey: [INVENTORY_QUERY_KEY, orgId],
    queryFn: () => {
      if (!orgId) throw new Error('Organisation manquante')
      return fetchInventorySessions(orgId)
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

export function useSessionCounts(sessionId: string | null) {
  return useQuery({
    queryKey: ['inventory-counts', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('Session manquante')
      return fetchSessionCounts(sessionId)
    },
    enabled: Boolean(sessionId),
    staleTime: 30 * 1000,
  })
}

export function useCreateInventorySession() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.user.orgId
  const operatorId = session?.user.id
  const { data: products } = useProducts()
  const { data: stock } = useStock()

  return useMutation({
    mutationFn: ({ locationId, name }: { locationId: string; name: string }) => {
      if (!orgId || !operatorId) throw new Error('Session invalide')
      if (!products) throw new Error('Produits non chargés')
      return createInventorySession(orgId, locationId, name, operatorId, products, stock ?? [])
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY, orgId] })
    },
  })
}

export function useUpdateCount(sessionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ countId, countedQuantity }: { countId: string; countedQuantity: number }) => {
      return updateCount(countId, countedQuantity)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory-counts', sessionId] })
    },
  })
}

export function useApplyInventorySession() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.user.orgId

  return useMutation({
    mutationFn: applyInventorySession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY, orgId] })
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
      void queryClient.invalidateQueries({ queryKey: ['movements'] })
    },
  })
}
