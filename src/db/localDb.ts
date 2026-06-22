import Dexie, { type EntityTable } from 'dexie'
import type { Product, StockLevel, Movement, PendingOperation } from '@/types'

interface Setting {
  key: string
  value: string
}

export interface LocalDB extends Dexie {
  products: EntityTable<Product, 'id'>
  stockLevels: EntityTable<StockLevel, 'id'>
  movements: EntityTable<Movement, 'id'>
  pendingOperations: EntityTable<PendingOperation, 'id'>
  settings: EntityTable<Setting, 'key'>
}

export const localDb = new Dexie('StockFlowDB') as LocalDB

localDb.version(1).stores({
  products: 'id, orgId, name, category, isActive',
  stockLevels: 'id, productId, locationId, [productId+locationId]',
  movements: 'id, productId, locationId, type, createdAt',
  pendingOperations: 'id, type, status, createdAt',
  settings: 'key',
})
