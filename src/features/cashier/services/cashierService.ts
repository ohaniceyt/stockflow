import { supabase } from '@/services/supabase'
import { edgeFetch } from '@/services/edgeFunctions'
import { mapReceipt, mapReceiptItem } from '@/features/invoicing/services/receiptService'
import type { CashierSession, Movement, ReceiptWithItems } from '@/types'

import type { Database } from '@/types/database'

type CashierSessionStatus = CashierSession['status']

type CashierSessionRow = Database['public']['Tables']['cashier_sessions']['Row']
type ReceiptRow = Database['public']['Tables']['receipts']['Row']
type ReceiptItemRow = Database['public']['Tables']['receipt_items']['Row']

function mapRowToCashierSession(row: CashierSessionRow): CashierSession {
  return {
    id: row.id,
    orgId: row.org_id,
    locationId: row.location_id,
    operatorId: row.operator_id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingBalance: row.opening_balance,
    closingBalance: row.closing_balance,
    dailyRevenue: row.daily_revenue ?? 0,
    status: row.status as CashierSessionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchOpenSession(
  orgId: string,
  locationId: string
): Promise<CashierSession | null> {
  const { data, error } = await supabase
    .from('cashier_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  return data ? mapRowToCashierSession(data) : null
}

export async function openSession(input: {
  orgId: string
  locationId: string
  operatorId: string
  openingBalance: number
}): Promise<CashierSession> {
  const { data, error } = await supabase
    .from('cashier_sessions')
    .insert({
      org_id: input.orgId,
      location_id: input.locationId,
      operator_id: input.operatorId,
      opening_balance: input.openingBalance,
      status: 'open',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapRowToCashierSession(data)
}

export async function closeSession(input: {
  sessionId: string
  closingBalance: number
  dailyRevenue: number
}): Promise<CashierSession> {
  const { data, error } = await supabase
    .from('cashier_sessions')
    .update({
      closing_balance: input.closingBalance,
      daily_revenue: input.dailyRevenue,
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', input.sessionId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapRowToCashierSession(data)
}

export interface CompleteSaleInput {
  locationId: string
  cashierSessionId: string
  contactId?: string | null
  paymentMethod: 'cash' | 'card' | 'mobile_money' | 'transfer' | 'other'
  currency: string
  prefix?: string | null
  subtotal: number
  taxAmount: number
  total: number
  amountPaid: number
  changeDue: number
  notes?: string | null
  items: {
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    discountAmount?: number
    taxAmount?: number
    total: number
  }[]
}

interface CompleteSaleResponse {
  receipt: ReceiptRow
  items: ReceiptItemRow[]
}

export async function completeSale(input: CompleteSaleInput): Promise<ReceiptWithItems> {
  const response = await edgeFetch<CompleteSaleResponse>('complete-sale', {
    method: 'POST',
    body: JSON.stringify({
      location_id: input.locationId,
      cashier_session_id: input.cashierSessionId,
      contact_id: input.contactId ?? null,
      payment_method: input.paymentMethod,
      currency: input.currency,
      prefix: input.prefix ?? null,
      subtotal: input.subtotal,
      tax_amount: input.taxAmount,
      total: input.total,
      amount_paid: input.amountPaid,
      change_due: input.changeDue,
      notes: input.notes ?? null,
      items: input.items.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discountAmount ?? 0,
        tax_amount: item.taxAmount ?? 0,
        total: item.total,
      })),
    }),
  })

  return {
    ...mapReceipt(response.receipt),
    items: response.items.map(mapReceiptItem),
  }
}

export async function cancelSale(input: {
  receiptId?: string
  movementId?: string
}): Promise<void> {
  await edgeFetch('cancel-sale', {
    method: 'POST',
    body: JSON.stringify({
      receipt_id: input.receiptId ?? null,
      movement_id: input.movementId ?? null,
    }),
  })
}

export function filterSalesBySession(movements: Movement[], sessionId: string | null): Movement[] {
  if (!sessionId) return []
  return movements.filter(
    (m) => m.cashierSessionId === sessionId && m.type === 'OUT' && !m.isCancelled
  )
}

export function computeSessionRevenue(movements: Movement[]): number {
  return movements.reduce((sum, m) => sum + (m.unitPrice ?? 0) * m.quantity, 0)
}
