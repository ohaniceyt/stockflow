import { fetchProducts } from '@/features/products/services/productService'
import { fetchLocations } from '@/features/locations/services/locationService'
import { fetchStock } from '@/features/stock/services/stockService'
import { fetchMovements } from '@/features/movements/services/movementService'
import {
  fetchInventorySessions,
  fetchSessionCounts,
} from '@/features/inventory/services/inventoryService'
import {
  cacheProducts,
  cacheLocations,
  cacheStockLevels,
  cacheMovements,
  cacheInventorySessions,
  cacheInventoryCounts,
} from './cacheService'
import { db } from '@/lib/db'

export interface PullSyncResult {
  productCount: number
  locationCount: number
  stockLevelCount: number
  movementCount: number
  sessionCount: number
  countCount: number
}

export async function pullSync(orgId: string): Promise<PullSyncResult> {
  if (!orgId) {
    throw new Error('Cannot pull sync without an organization id')
  }

  const [products, locations, stockItems, movements, sessions] = await Promise.all([
    fetchProducts(orgId),
    fetchLocations(orgId),
    fetchStock(),
    fetchMovements(),
    fetchInventorySessions(orgId),
  ])

  // Pull counts for all sessions
  const countsNested = await Promise.all(sessions.map((s) => fetchSessionCounts(s.id)))
  const counts = countsNested.flat()

  // Map StockItem[] to StockLevel[] for the cache
  const stockLevels = stockItems.map((item) => ({
    id: item.id,
    productId: item.productId,
    locationId: item.locationId,
    quantity: item.quantity,
    updatedAt: item.updatedAt,
  }))

  // Persist everything locally
  await Promise.all([
    cacheProducts(products),
    cacheLocations(locations),
    cacheStockLevels(stockLevels),
    cacheMovements(movements),
    cacheInventorySessions(sessions),
    cacheInventoryCounts(counts),
  ])

  await db.syncMeta.put({
    id: 'global',
    lastSyncAt: Date.now(),
    status: 'idle',
  })

  return {
    productCount: products.length,
    locationCount: locations.length,
    stockLevelCount: stockLevels.length,
    movementCount: movements.length,
    sessionCount: sessions.length,
    countCount: counts.length,
  }
}
