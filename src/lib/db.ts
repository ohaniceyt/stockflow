import Dexie, { type Table } from 'dexie'
import type {
  Product,
  StockLevel,
  Movement,
  InventorySession,
  InventoryCount,
  Location,
  Contact,
  Category,
  PendingOperation,
} from '@/types'

export type CachedProduct = Product
export type CachedLocation = Location
export type CachedStockLevel = StockLevel
export type CachedMovement = Movement
export type CachedInventorySession = InventorySession
export type CachedInventoryCount = InventoryCount
export type CachedContact = Contact
export type CachedCategory = Category
export type QueuedOperation = PendingOperation

export interface SyncMeta {
  id: string
  lastSyncAt: number
  status: 'idle' | 'syncing' | 'error'
}

class StockFlowDB extends Dexie {
  products!: Table<CachedProduct, string>
  categories!: Table<CachedCategory, string>
  locations!: Table<CachedLocation, string>
  stockLevels!: Table<CachedStockLevel, string>
  movements!: Table<CachedMovement, string>
  inventorySessions!: Table<CachedInventorySession, string>
  inventoryCounts!: Table<CachedInventoryCount, string>
  contacts!: Table<CachedContact, string>
  pendingOperations!: Table<QueuedOperation, string>
  syncMeta!: Table<SyncMeta, string>

  constructor() {
    super('StockFlowDB')
    this.version(5)
      .stores({
        products: 'id, orgId, name, category, isActive',
        categories: 'id, orgId, name',
        locations: 'id, orgId, name',
        stockLevels: 'id, productId, locationId, orgId, quantity',
        movements: 'id, productId, locationId, orgId, type, cashierSessionId, createdAt',
        inventorySessions: 'id, orgId, locationId, status, startedAt',
        inventoryCounts: 'id, orgId, sessionId, productId, locationId',
        contacts: 'id, orgId, type, name, isActive',
        pendingOperations: 'id, type, status, createdAt, nextRetryAt',
        syncMeta: 'id',
      })
      .upgrade((tx) => {
        // Migrate stock_levels and movements to include orgId by resolving it
        // from the cached products/locations tables. If a record cannot be
        // resolved, it remains without an orgId and will be replaced on the
        // next successful pull sync.
        const productsTable = tx.table('products') as unknown as Dexie.Table<Product, string>
        const locationsTable = tx.table('locations') as unknown as Dexie.Table<Location, string>
        const stockTable = tx.table('stockLevels') as unknown as Dexie.Table<StockLevel, string>
        const movementsTable = tx.table('movements') as unknown as Dexie.Table<Movement, string>

        return Promise.all([
          productsTable.toArray().then((products) => {
            const productOrgMap = new Map(products.map((p) => [p.id, p.orgId]))
            return stockTable.toCollection().modify((level) => {
              level.orgId = productOrgMap.get(level.productId) ?? ''
            })
          }),
          Promise.all([
            productsTable
              .toArray()
              .then((products) => new Map(products.map((p) => [p.id, p.orgId]))),
            locationsTable
              .toArray()
              .then((locations) => new Map(locations.map((l) => [l.id, l.orgId]))),
          ]).then(([productOrgMap, locationOrgMap]) => {
            return movementsTable.toCollection().modify((movement) => {
              movement.orgId =
                productOrgMap.get(movement.productId) ??
                locationOrgMap.get(movement.locationId) ??
                ''
            })
          }),
        ])
      })
  }
}

export const db = new StockFlowDB()
