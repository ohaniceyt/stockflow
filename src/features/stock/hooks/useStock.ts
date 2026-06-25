import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { fetchStock } from '../services/stockService'
import {
  getCachedStockLevels,
  cacheStockLevels,
  getCachedProducts,
  getCachedLocations,
} from '@/features/offline/services/cacheService'
import type { Product, Location } from '@/types'
import type { StockItem } from '../services/stockService'

const STOCK_QUERY_KEY = 'stock'

export function useStock() {
  const { session } = useAuth()
  const orgId = session?.membership.orgId

  return useQuery({
    queryKey: [STOCK_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organisation manquante')
      try {
        const data = await fetchStock(orgId)
        await cacheStockLevels(
          data.map((item) => ({
            id: item.id,
            orgId,
            productId: item.productId,
            locationId: item.locationId,
            quantity: item.quantity,
            updatedAt: item.updatedAt,
          }))
        )
        return data
      } catch (err) {
        // Fall back to the local cache on any fetch failure, not only when explicitly offline.
        const [cachedLevels, products, locations] = await Promise.all([
          getCachedStockLevels(orgId),
          getCachedProducts(orgId),
          getCachedLocations(orgId),
        ])
        if (cachedLevels.length > 0) {
          return mapCachedToStockItems(cachedLevels, products, locations)
        }
        throw err
      }
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  })
}

function mapCachedToStockItems(
  levels: {
    id: string
    orgId: string
    productId: string
    locationId: string
    quantity: number
    updatedAt: string
  }[],
  products: Product[],
  locations: Location[]
): StockItem[] {
  const productMap = new Map(products.map((p) => [p.id, p]))
  const locationMap = new Map(locations.map((l) => [l.id, l]))

  return levels.map((level) => {
    const product = productMap.get(level.productId)
    const location = locationMap.get(level.locationId)
    return {
      id: level.id,
      productId: level.productId,
      productName: product?.name ?? 'Produit hors ligne',
      productUnit: product?.unit ?? 'unité',
      category: product?.category ?? null,
      barcode: product?.barcode ?? null,
      threshold: product?.threshold ?? 0,
      costPrice: product?.costPrice ?? 0,
      sellingPrice: product?.sellingPrice ?? 0,
      locationId: level.locationId,
      locationName: location?.name ?? 'Emplacement hors ligne',
      quantity: level.quantity,
      updatedAt: level.updatedAt,
    }
  })
}
