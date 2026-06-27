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
import type {
  Product,
  Category,
  Location,
  StockLevel,
  Movement,
  InventorySession,
  InventoryCount,
  Contact,
} from '@/types'

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

function parseTimestamp(value: string | undefined | null): number | undefined {
  if (!value) return undefined
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? undefined : ms
}

function buildServerSnapshots(
  products: Product[],
  categories: Category[],
  locations: Location[],
  stockLevels: StockLevel[],
  movements: Movement[],
  sessions: InventorySession[],
  counts: InventoryCount[],
  contacts: Contact[]
): Record<string, number> {
  const snapshots: Record<string, number> = {}

  for (const p of products) {
    const ts = parseTimestamp(p.updatedAt)
    if (ts !== undefined) snapshots[`products:${p.id}`] = ts
  }
  for (const c of categories) {
    const ts = parseTimestamp(c.updatedAt)
    if (ts !== undefined) snapshots[`categories:${c.id}`] = ts
  }
  for (const l of locations) {
    const ts = parseTimestamp(l.createdAt)
    if (ts !== undefined) snapshots[`locations:${l.id}`] = ts
  }
  for (const sl of stockLevels) {
    const ts = parseTimestamp(sl.updatedAt)
    if (ts !== undefined) snapshots[`stockLevels:${sl.productId}:${sl.locationId}`] = ts
  }
  for (const m of movements) {
    const ts = parseTimestamp(m.createdAt)
    if (ts !== undefined) snapshots[`movements:${m.id}`] = ts
  }
  for (const s of sessions) {
    const ts = parseTimestamp(s.startedAt)
    if (ts !== undefined) snapshots[`inventorySessions:${s.id}`] = ts
  }
  for (const c of counts) {
    const ts = parseTimestamp(c.createdAt)
    if (ts !== undefined) snapshots[`inventoryCounts:${c.id}`] = ts
  }
  for (const c of contacts) {
    const ts = parseTimestamp(c.updatedAt)
    if (ts !== undefined) snapshots[`contacts:${c.id}`] = ts
  }

  return snapshots
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

  const serverSnapshots = buildServerSnapshots(
    products,
    categories,
    locations,
    stockLevels,
    movements,
    sessions,
    counts,
    contacts
  )
  const existingMeta = await db.syncMeta.get('global')

  await db.syncMeta.put({
    ...existingMeta,
    id: 'global',
    lastSyncAt: Date.now(),
    status: 'idle',
    serverSnapshots,
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
