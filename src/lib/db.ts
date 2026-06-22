import Dexie, { type Table } from 'dexie'
import type {
  Product,
  StockLevel,
  Movement,
  InventorySession,
  InventoryCount,
  Location,
} from '@/types'

export type CachedProduct = Product
export type CachedLocation = Location
export type CachedStockLevel = StockLevel
export type CachedMovement = Movement
export type CachedInventorySession = InventorySession
export type CachedInventoryCount = InventoryCount

export interface QueuedOperation {
  id: string
  type: 'MOVEMENT' | 'INVENTORY' | 'PRODUCT_CREATE'
  payload: unknown
  createdAt: number
  retryCount: number
  status: 'pending' | 'syncing' | 'failed'
  error?: string
}

export interface SyncMeta {
  id: string
  lastSyncAt: number
  status: 'idle' | 'syncing' | 'error'
}

class StockFlowDB extends Dexie {
  products!: Table<CachedProduct, string>
  locations!: Table<CachedLocation, string>
  stockLevels!: Table<CachedStockLevel, string>
  movements!: Table<CachedMovement, string>
  inventorySessions!: Table<CachedInventorySession, string>
  inventoryCounts!: Table<CachedInventoryCount, string>
  pendingOperations!: Table<QueuedOperation, string>
  syncMeta!: Table<SyncMeta, string>

  constructor() {
    super('StockFlowDB')
    this.version(1).stores({
      products: 'id, orgId, name, category, isActive',
      locations: 'id, orgId, name',
      stockLevels: 'id, productId, locationId, quantity',
      movements: 'id, productId, locationId, type, createdAt',
      inventorySessions: 'id, orgId, locationId, status, startedAt',
      inventoryCounts: 'id, sessionId, productId, locationId',
      pendingOperations: 'id, type, status, createdAt',
      syncMeta: 'id',
    })
  }
}

export const db = new StockFlowDB()
