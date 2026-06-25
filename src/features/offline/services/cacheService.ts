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

export async function cacheProducts(products: Product[]): Promise<void> {
  await db.transaction('rw', db.products, async () => {
    await db.products.clear()
    await db.products.bulkPut(products)
  })
}

export async function cacheCategories(categories: Category[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    await db.categories.clear()
    await db.categories.bulkPut(categories)
  })
}

export async function cacheLocations(locations: Location[]): Promise<void> {
  await db.transaction('rw', db.locations, async () => {
    await db.locations.clear()
    await db.locations.bulkPut(locations)
  })
}

export async function cacheStockLevels(stockLevels: StockLevel[]): Promise<void> {
  await db.transaction('rw', db.stockLevels, async () => {
    await db.stockLevels.clear()
    await db.stockLevels.bulkPut(stockLevels)
  })
}

export async function cacheMovements(movements: Movement[]): Promise<void> {
  await db.transaction('rw', db.movements, async () => {
    await db.movements.clear()
    await db.movements.bulkPut(movements)
  })
}

export async function cacheInventorySessions(sessions: InventorySession[]): Promise<void> {
  await db.transaction('rw', db.inventorySessions, async () => {
    await db.inventorySessions.clear()
    await db.inventorySessions.bulkPut(sessions)
  })
}

export async function cacheInventoryCounts(counts: InventoryCount[]): Promise<void> {
  await db.transaction('rw', db.inventoryCounts, async () => {
    await db.inventoryCounts.clear()
    await db.inventoryCounts.bulkPut(counts)
  })
}

export async function cacheContacts(contacts: Contact[]): Promise<void> {
  await db.transaction('rw', db.contacts, async () => {
    await db.contacts.clear()
    await db.contacts.bulkPut(contacts)
  })
}

export async function getCachedProducts(orgId: string): Promise<Product[]> {
  return db.products.where('orgId').equals(orgId).toArray()
}

export async function getCachedCategories(orgId: string): Promise<Category[]> {
  return db.categories.where('orgId').equals(orgId).toArray()
}

export async function getCachedLocations(orgId: string): Promise<Location[]> {
  return db.locations.where('orgId').equals(orgId).toArray()
}

export async function getCachedStockLevels(orgId: string): Promise<StockLevel[]> {
  return db.stockLevels.where('orgId').equals(orgId).toArray()
}

export async function getCachedMovements(orgId: string): Promise<Movement[]> {
  return db.movements.where('orgId').equals(orgId).reverse().sortBy('createdAt')
}

export async function getCachedInventorySessions(orgId: string): Promise<InventorySession[]> {
  return db.inventorySessions.where('orgId').equals(orgId).toArray()
}

export async function getCachedInventoryCounts(orgId?: string): Promise<InventoryCount[]> {
  if (!orgId) return db.inventoryCounts.toArray()
  return db.inventoryCounts.where('orgId').equals(orgId).toArray()
}

export async function getCachedContacts(orgId: string): Promise<Contact[]> {
  return db.contacts.where('orgId').equals(orgId).toArray()
}

export async function getLastSyncAt(): Promise<number | null> {
  const meta = await db.syncMeta.get('global')
  return meta?.lastSyncAt ?? null
}
