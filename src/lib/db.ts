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
} from '@/types'

export type CachedProduct = Product
export type CachedLocation = Location
export type CachedStockLevel = StockLevel
export type CachedMovement = Movement
export type CachedInventorySession = InventorySession
export type CachedInventoryCount = InventoryCount
export type CachedContact = Contact
export type CachedCategory = Category

export interface QueuedOperation {
  id: string
  type:
    | 'MOVEMENT'
    | 'INVENTORY'
    | 'PRODUCT_CREATE'
    | 'PRODUCT_UPDATE'
    | 'INVENTORY_COUNT_UPDATE'
    | 'CONTACT_CREATE'
    | 'CONTACT_UPDATE'
  payload: unknown
  createdAt: number
  retryCount: number
  status: 'pending' | 'syncing' | 'failed' | 'dead'
  error?: string
  nextRetryAt?: number
}

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
    this.version(4).stores({
      products: 'id, orgId, name, category, isActive',
      categories: 'id, orgId, name',
      locations: 'id, orgId, name',
      stockLevels: 'id, productId, locationId, quantity',
      movements: 'id, productId, locationId, type, createdAt',
      inventorySessions: 'id, orgId, locationId, status, startedAt',
      inventoryCounts: 'id, sessionId, productId, locationId',
      contacts: 'id, orgId, type, name, isActive',
      pendingOperations: 'id, type, status, createdAt, nextRetryAt',
      syncMeta: 'id',
    })
  }
}

export const db = new StockFlowDB()
