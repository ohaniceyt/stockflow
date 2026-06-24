import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchStock, recordMovement } from '../services/stockService'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import { queueOperation } from '@/features/offline/services/queueService'
import { getCachedStockLevels, cacheStockLevels } from '@/features/offline/services/cacheService'
import type { StockItem } from '../services/stockService'

const STOCK_QUERY_KEY = 'stock'

export function useStock() {
  const online = useNetworkStatus()

  return useQuery({
    queryKey: [STOCK_QUERY_KEY],
    queryFn: async () => {
      try {
        const data = await fetchStock()
        await cacheStockLevels(
          data.map((item) => ({
            id: item.id,
            productId: item.productId,
            locationId: item.locationId,
            quantity: item.quantity,
            updatedAt: item.updatedAt,
          }))
        )
        return data
      } catch (err) {
        if (!online) {
          const cached = await getCachedStockLevels()
          if (cached.length > 0) return cached.map(mapCachedToStockItem)
        }
        throw err
      }
    },
    staleTime: 30 * 1000,
  })
}

export function useRecordMovement() {
  const queryClient = useQueryClient()
  const online = useNetworkStatus()

  return useMutation({
    mutationFn: (input: Parameters<typeof recordMovement>[0]) => {
      if (!online) {
        return queueOperation({
          type: 'MOVEMENT',
          payload: input,
        }).then(() => undefined)
      }
      return recordMovement(input)
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: [STOCK_QUERY_KEY] })
      const previousStock = queryClient.getQueryData<StockItem[]>([STOCK_QUERY_KEY])

      queryClient.setQueryData([STOCK_QUERY_KEY], (old: StockItem[] | undefined) => {
        if (!old) return old
        return old.map((item) => {
          const isSource =
            item.productId === input.productId && item.locationId === input.locationId
          const isTarget =
            input.type === 'TRANSFER' &&
            input.targetLocationId &&
            item.productId === input.productId &&
            item.locationId === input.targetLocationId

          if (!isSource && !isTarget) return item

          let delta = 0
          if (isSource) {
            delta = input.type === 'IN' ? input.quantity : -input.quantity
          }
          if (isTarget) {
            delta = input.quantity
          }

          return { ...item, quantity: Math.max(0, item.quantity + delta) }
        })
      })

      return { previousStock }
    },
    onError: (_err, _input, context) => {
      if (context?.previousStock) {
        queryClient.setQueryData([STOCK_QUERY_KEY], context.previousStock)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [STOCK_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: ['movements'] })
    },
  })
}

function mapCachedToStockItem(level: {
  id: string
  productId: string
  locationId: string
  quantity: number
  updatedAt: string
}): StockItem {
  return {
    id: level.id,
    productId: level.productId,
    productName: 'Produit hors ligne',
    productUnit: 'unité',
    category: null,
    barcode: null,
    threshold: 0,
    costPrice: 0,
    sellingPrice: 0,
    locationId: level.locationId,
    locationName: 'Emplacement hors ligne',
    quantity: level.quantity,
    updatedAt: level.updatedAt,
  }
}
