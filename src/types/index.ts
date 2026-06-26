export type UserRole = 'super_admin' | 'admin' | 'operator' | 'cashier' | 'reader'
export type PlatformAdminRole = 'super_admin' | 'moderator'

export interface Organization {
  id: string
  name: string
  slug: string
  country: string | null
  currency: string
  timezone: string
  isActive: boolean
  isSuspended: boolean
  suspensionReason: string | null
  onboardingCompleted: boolean
  hasCashierEnabled: boolean
  hasStorefrontEnabled: boolean
  hasApiEnabled: boolean
  storefrontLocationId: string | null
  hasInvoicingEnabled: boolean
  hasTaxEnabled: boolean
  taxName: string | null
  taxRate: number | null
  taxId: string | null
  invoicePrefix: string | null
  quotePrefix: string | null
  deliveryNotePrefix: string | null
  receiptPrefix: string | null
  legalMentions: string | null
  autoReminderEnabled: boolean
  autoReminderDays: number | null
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
  hasPin: boolean
  pinHash?: string | null
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

export interface Receipt {
  id: string
  orgId: string
  locationId: string
  cashierSessionId: string | null
  operatorId: string
  contactId: string | null
  documentNumber: string
  paymentMethod: 'cash' | 'card' | 'mobile_money' | 'transfer' | 'other'
  currency: string
  subtotal: number
  taxAmount: number
  total: number
  amountPaid: number
  changeDue: number
  notes: string | null
  isCancelled: boolean
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ReceiptItem {
  id: string
  receiptId: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  total: number
  createdAt: string
}

export interface ReceiptWithItems extends Receipt {
  items: ReceiptItem[]
}

export type DocumentType = 'invoice' | 'quote' | 'delivery_note'
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'cancelled'
  | 'converted'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted' | 'cancelled'
export type DeliveryNoteStatus = 'draft' | 'sent' | 'delivered' | 'cancelled'
export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'transfer' | 'other'

export interface Invoice {
  id: string
  orgId: string
  contactId: string | null
  type: 'invoice'
  documentNumber: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string | null
  currency: string
  subtotal: number
  taxTotal: number
  total: number
  paidAmount: number
  quoteId: string | null
  movementIds: string[] | null
  note: string | null
  terms: string | null
  sentAt: string | null
  deliveryAddress: string | null
  deliveredAt: string | null
  convertedToInvoiceId: string | null
  createdAt: string
  updatedAt: string
}

export interface Quote {
  id: string
  orgId: string
  contactId: string | null
  type: 'quote'
  documentNumber: string
  status: QuoteStatus
  issueDate: string
  dueDate: string | null
  currency: string
  subtotal: number
  taxTotal: number
  total: number
  convertedToInvoiceId: string | null
  movementIds: string[] | null
  note: string | null
  terms: string | null
  convertedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DeliveryNote {
  id: string
  orgId: string
  contactId: string | null
  type: 'delivery_note'
  documentNumber: string
  status: DeliveryNoteStatus
  issueDate: string
  dueDate: string | null
  currency: string
  subtotal: number
  taxTotal: number
  total: number
  deliveryAddress: string | null
  deliveredAt: string | null
  sentAt: string | null
  movementIds: string[] | null
  note: string | null
  terms: string | null
  createdAt: string
  updatedAt: string
}

export interface DocumentItem {
  id: string
  documentId: string
  productId: string | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discountAmount: number
  total: number
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  orgId: string
  invoiceId: string
  amount: number
  paymentMethod: PaymentMethod
  reference: string | null
  paidAt: string
  createdAt: string
  updatedAt: string
}

export interface InvoiceWithItems extends Invoice {
  items: DocumentItem[]
  payments: Payment[]
}

export interface QuoteWithItems extends Quote {
  items: DocumentItem[]
}

export interface DeliveryNoteWithItems extends DeliveryNote {
  items: DocumentItem[]
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
  checksum?: string
  localUpdatedAt?: number
}
