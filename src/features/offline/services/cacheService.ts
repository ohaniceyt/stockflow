import { db } from '@/lib/db'
import type {
  Product,
  Location,
  StockLevel,
  Movement,
  InventorySession,
  InventoryCount,
} from '@/types'

export async function cacheProducts(products: Product[]): Promise<void> {
  await db.products.bulkPut(products)
}

export async function cacheLocations(locations: Location[]): Promise<void> {
  await db.locations.bulkPut(locations)
}

export async function cacheStockLevels(stockLevels: StockLevel[]): Promise<void> {
  await db.stockLevels.bulkPut(stockLevels)
}

export async function cacheMovements(movements: Movement[]): Promise<void> {
  await db.movements.bulkPut(movements)
}

export async function cacheInventorySessions(sessions: InventorySession[]): Promise<void> {
  await db.inventorySessions.bulkPut(sessions)
}

export async function cacheInventoryCounts(counts: InventoryCount[]): Promise<void> {
  await db.inventoryCounts.bulkPut(counts)
}

export async function getCachedProducts(orgId: string): Promise<Product[]> {
  return db.products.where('orgId').equals(orgId).toArray()
}

export async function getCachedLocations(orgId: string): Promise<Location[]> {
  return db.locations.where('orgId').equals(orgId).toArray()
}

export async function getCachedStockLevels(): Promise<StockLevel[]> {
  return db.stockLevels.toArray()
}

export async function getCachedMovements(): Promise<Movement[]> {
  return db.movements.orderBy('createdAt').reverse().toArray()
}

export async function getCachedInventorySessions(orgId: string): Promise<InventorySession[]> {
  return db.inventorySessions.where('orgId').equals(orgId).toArray()
}

export async function getLastSyncAt(): Promise<number | null> {
  const meta = await db.syncMeta.get('global')
  return meta?.lastSyncAt ?? null
}
