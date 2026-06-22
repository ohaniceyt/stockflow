export type UserRole = 'super_admin' | 'admin' | 'operator' | 'reader'

export interface Organization {
  id: string
  name: string
  currency: string
  timezone: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  orgId: string
  name: string
  email: string
  emailVerified: boolean
  role: UserRole
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Location {
  id: string
  orgId: string
  name: string
  description: string | null
  address: string | null
  isDefault: boolean
  createdAt: string
}

export interface Product {
  id: string
  orgId: string
  name: string
  category: string | null
  unit: string
  threshold: number
  costPrice: number
  sellingPrice: number
  supplier: string | null
  description: string | null
  barcode: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface StockLevel {
  id: string
  productId: string
  locationId: string
  quantity: number
  updatedAt: string
}

export type MovementType = 'IN' | 'OUT' | 'INVENTORY' | 'ADJUSTMENT' | 'TRANSFER'

export interface Movement {
  id: string
  productId: string
  locationId: string
  targetLocationId: string | null
  type: MovementType
  quantity: number
  stockBefore: number
  stockAfter: number
  reason: string | null
  operatorId: string
  referenceId: string | null
  createdAt: string
}

export interface InventorySession {
  id: string
  orgId: string
  locationId: string
  name: string
  status: 'pending' | 'completed' | 'cancelled'
  startedAt: string
  completedAt: string | null
  operatorId: string
}

export interface InventoryCount {
  id: string
  sessionId: string
  productId: string
  locationId: string
  theoreticalQuantity: number
  countedQuantity: number
  difference: number
  isValidated: boolean
  createdAt: string
}

export interface PendingOperation {
  id: string
  type: 'MOVEMENT' | 'INVENTORY' | 'PRODUCT_CREATE'
  payload: unknown
  createdAt: string
  retryCount: number
  status: 'pending' | 'syncing' | 'failed'
  error?: string
}
