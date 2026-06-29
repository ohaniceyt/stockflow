import { supabase } from '@/services/supabase'
import { mapOrganizationRow } from '@/features/settings/services/organizationService'
import { completeSale } from '@/features/cashier/services/cashierService'
import { mapReceipt, mapReceiptItem } from '@/features/cashier/services/receiptMapper'
import type { ReceiptWithItems, Organization } from '@/types'
import type { Database } from '@/types/database'

type ReceiptRow = Database['public']['Tables']['receipts']['Row']
type ReceiptItemRow = Database['public']['Tables']['receipt_items']['Row']

export interface CreateReceiptInput {
  orgId: string
  locationId: string
  cashierSessionId: string
  operatorId: string
  contactId?: string | null
  paymentMethod: 'cash' | 'card' | 'mobile_money' | 'transfer' | 'other'
  currency: string
  prefix?: string
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

export async function createReceipt(input: CreateReceiptInput): Promise<ReceiptWithItems> {
  // All receipt creation must go through the hardened server-side path so that
  // financial totals are recalculated from the cart lines instead of trusting
  // values sent by the client.
  return completeSale({
    locationId: input.locationId,
    cashierSessionId: input.cashierSessionId,
    contactId: input.contactId,
    paymentMethod: input.paymentMethod,
    currency: input.currency,
    prefix: input.prefix,
    amountPaid: input.amountPaid,
    changeDue: input.changeDue,
    total: input.total,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    notes: input.notes,
    items: input.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      taxAmount: item.taxAmount,
      total: item.total,
    })),
  })
}

export async function getReceiptsBySession(cashierSessionId: string): Promise<ReceiptWithItems[]> {
  const { data: receipts, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('cashier_session_id', cashierSessionId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  if (receipts.length === 0) {
    return []
  }

  const receiptIds = receipts.map((r) => r.id)
  const { data: items, error: itemsError } = await supabase
    .from('receipt_items')
    .select('*')
    .in('receipt_id', receiptIds)

  if (itemsError) {
    throw itemsError
  }

  const itemsByReceipt = new Map<string, ReceiptItemRow[]>()
  for (const item of items as ReceiptItemRow[]) {
    const list = itemsByReceipt.get(item.receipt_id) ?? []
    list.push(item)
    itemsByReceipt.set(item.receipt_id, list)
  }

  return (receipts as ReceiptRow[]).map((row) => ({
    ...mapReceipt(row),
    items: (itemsByReceipt.get(row.id) ?? []).map(mapReceiptItem),
  }))
}

export async function getReceiptWithOrg(
  receiptId: string
): Promise<{ receipt: ReceiptWithItems; org: Organization }> {
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', receiptId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (receiptError || !receipt) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    throw receiptError ?? new Error('Receipt not found')
  }

  const { data: items, error: itemsError } = await supabase
    .from('receipt_items')
    .select('*')
    .eq('receipt_id', receiptId)

  if (itemsError) {
    throw itemsError
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', receipt.org_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (orgError || !org) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    throw orgError ?? new Error('Organization not found')
  }

  return {
    receipt: {
      ...mapReceipt(receipt),
      items: items.map(mapReceiptItem),
    },
    org: mapOrganizationRow(org),
  }
}

