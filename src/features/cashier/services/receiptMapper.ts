import type { Receipt, ReceiptItem } from '@/types'
import type { Database } from '@/types/database'

type ReceiptRow = Database['public']['Tables']['receipts']['Row']
type ReceiptItemRow = Database['public']['Tables']['receipt_items']['Row']

export function mapReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    orgId: row.org_id,
    locationId: row.location_id,
    cashierSessionId: row.cashier_session_id,
    operatorId: row.operator_id ?? '',
    contactId: row.contact_id,
    documentNumber: row.document_number,
    paymentMethod: row.payment_method ? (row.payment_method as Receipt['paymentMethod']) : 'other',
    currency: row.currency,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    total: row.total,
    amountPaid: row.amount_paid,
    changeDue: row.change_due,
    notes: row.notes,
    isCancelled: row.is_cancelled,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapReceiptItem(row: ReceiptItemRow): ReceiptItem {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    total: row.total,
    createdAt: row.created_at,
  }
}
