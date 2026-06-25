import { fetchProducts } from '@/features/products/services/productService'
import { fetchLocations } from '@/features/locations/services/locationService'
import { fetchStock } from '@/features/stock/services/stockService'
import { fetchMovements, MOVEMENTS_PAGE_SIZE } from '@/features/movements/services/movementService'
import {
  fetchInventorySessions,
  fetchSessionCounts,
} from '@/features/inventory/services/inventoryService'
import { fetchContacts } from '@/features/contacts/services/contactService'
import { fetchCategories } from '@/features/products/services/categoryService'
import {
  cacheProducts,
  cacheCategories,
  cacheLocations,
  cacheStockLevels,
  cacheMovements,
  cacheInventorySessions,
  cacheInventoryCounts,
  cacheContacts,
} from './cacheService'
import { db } from '@/lib/db'

export interface PullSyncResult {
  productCount: number
  categoryCount: number
  locationCount: number
  stockLevelCount: number
  movementCount: number
  sessionCount: number
  countCount: number
  contactCount: number
}

export async function pullSync(orgId: string): Promise<PullSyncResult> {
  if (!orgId) {
    throw new Error('Cannot pull sync without an organization id')
  }

  const [products, categories, locations, stockItems, sessions, contacts] = await Promise.all([
    fetchProducts(orgId),
    fetchCategories(orgId),
    fetchLocations(orgId),
    fetchStock(orgId),
    fetchInventorySessions(orgId),
    fetchContacts(orgId),
  ])

  // Pull all movements across pages for offline cache.
  let page = 0
  let hasMore = true
  const movements = []
  while (hasMore) {
    const result = await fetchMovements({ orgId, page, pageSize: MOVEMENTS_PAGE_SIZE })
    movements.push(...result.movements)
    hasMore = result.hasMore
    page++
  }

  // Pull counts for all sessions
  const countsNested = await Promise.all(sessions.map((s) => fetchSessionCounts(s.id, orgId)))
  const counts = countsNested.flat().map((count) => ({ ...count, orgId }))

  // Map StockItem[] to StockLevel[] for the cache
  const stockLevels = stockItems.map((item) => ({
    id: item.id,
    orgId,
    productId: item.productId,
    locationId: item.locationId,
    quantity: item.quantity,
    updatedAt: item.updatedAt,
  }))

  // Persist everything locally
  await Promise.all([
    cacheProducts(products),
    cacheCategories(categories),
    cacheLocations(locations),
    cacheStockLevels(stockLevels),
    cacheMovements(movements.map((m) => ({ ...m, orgId }))),
    cacheInventorySessions(sessions),
    cacheInventoryCounts(counts),
    cacheContacts(contacts),
  ])

  await db.syncMeta.put({
    id: 'global',
    lastSyncAt: Date.now(),
    status: 'idle',
  })

  return {
    productCount: products.length,
    categoryCount: categories.length,
    locationCount: locations.length,
    stockLevelCount: stockLevels.length,
    movementCount: movements.length,
    sessionCount: sessions.length,
    countCount: counts.length,
    contactCount: contacts.length,
  }
}
