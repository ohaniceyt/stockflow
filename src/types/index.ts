export type UserRole = 'super_admin' | 'admin' | 'operator' | 'cashier' | 'reader'
export type PlatformAdminRole = 'super_admin' | 'moderator'

export interface Organization {
  id: string
  name: string
  slug: string
  currency: string
  timezone: string
  isActive: boolean
  isSuspended: boolean
  suspensionReason: string | null
  onboardingCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface Plan {
  id: string
  name: string
  description: string | null
  priceMonthly: number
  priceYearly: number
  maxUsers: number | null
  maxProducts: number | null
  maxLocations: number | null
  maxMonthlyMovements: number | null
  includesInventory: boolean
  includesApi: boolean
  isActive: boolean
  createdAt: string
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended'
export type BillingInterval = 'month' | 'year'

export interface Subscription {
  id: string
  orgId: string
  planId: string
  status: SubscriptionStatus
  billingInterval: BillingInterval
  currentPeriodStartsAt: string
  currentPeriodEndsAt: string
  trialEndsAt: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  canceledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PlatformAdmin {
  id: string
  authUserId: string
  email: string
  name: string | null
  role: PlatformAdminRole
  isActive: boolean
  createdAt: string
}

export interface SudoTarget {
  type: 'organization'
  id: string
  name: string
  targetUserId?: string
}

export interface PlatformAuditLog {
  id: string
  actorId: string | null
  actorRole: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: unknown
  createdAt: string
}

export interface OrgLimits {
  orgId: string
  planId: string
  isSuspended: boolean
  maxUsers: number | null
  maxProducts: number | null
  maxLocations: number | null
  maxMonthlyMovements: number | null
  usedUsers: number
  usedProducts: number
  usedLocations: number
  usedMovementsThisMonth: number
}

export interface User {
  id: string
  name: string
  email: string
  phone?: string | null
  emailVerified: boolean
  activeOrgId: string | null
  createdAt: string
  updatedAt: string
}

export interface OrganizationMembership {
  id: string
  orgId: string
  userId: string
  role: UserRole
  pinHash: string | null
  isActive: boolean
  forcePinChange: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UserWithMembership extends User {
  membership: OrganizationMembership
  organization: Organization
}

export interface TeamMember {
  membershipId: string
  userId: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  lastLoginAt: string | null
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

export interface Category {
  id: string
  orgId: string
  name: string
  createdAt: string
  updatedAt: string
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
  orgId: string
  productId: string
  locationId: string
  quantity: number
  updatedAt: string
}

export type ContactType = 'SUPPLIER' | 'CUSTOMER'

export interface Contact {
  id: string
  orgId: string
  type: ContactType
  name: string
  email: string | null
  phone: string | null
  address: string | null
  taxId: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type MovementType = 'IN' | 'OUT' | 'INVENTORY' | 'ADJUSTMENT' | 'TRANSFER'

export interface Movement {
  id: string
  orgId: string
  productId: string
  locationId: string
  targetLocationId: string | null
  type: MovementType
  quantity: number
  stockBefore: number
  stockAfter: number
  reason: string | null
  contactId: string | null
  unitPrice: number | null
  isCancelled: boolean
  cancelledBy: string | null
  cancelledAt: string | null
  cashierSessionId: string | null
  operatorId: string
  referenceId: string | null
  createdAt: string
}

export interface CashierSession {
  id: string
  orgId: string
  locationId: string
  operatorId: string
  openedAt: string
  closedAt: string | null
  openingBalance: number
  closingBalance: number | null
  dailyRevenue: number
  status: 'open' | 'closed'
  createdAt: string
  updatedAt: string
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
  orgId: string
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
  type:
    | 'MOVEMENT'
    | 'INVENTORY'
    | 'PRODUCT_CREATE'
    | 'PRODUCT_UPDATE'
    | 'INVENTORY_COUNT_UPDATE'
    | 'INVENTORY_SESSION_CREATE'
    | 'LOCATION_CREATE'
    | 'LOCATION_UPDATE'
    | 'LOCATION_SET_DEFAULT'
    | 'CONTACT_CREATE'
    | 'CONTACT_UPDATE'
    | 'CATEGORY_CREATE'
    | 'CATEGORY_UPDATE'
    | 'CATEGORY_DELETE'
  payload: unknown
  createdAt: number
  retryCount: number
  status: 'pending' | 'syncing' | 'failed' | 'dead'
  error?: string
  nextRetryAt?: number
}
