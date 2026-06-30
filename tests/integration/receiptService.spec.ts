import { describe, it, expect, vi } from 'vitest'

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({})),
    rpc: vi.fn(),
  },
}))

vi.mock('@/features/cashier/services/cashierService', () => ({
  completeSale: vi.fn(),
}))

import { createReceipt, getReceiptWithOrg } from '@/features/cashier/services/receiptService'
import { completeSale } from '@/features/cashier/services/cashierService'
import type { Database } from '@/types/database'

type ReceiptRow = Database['public']['Tables']['receipts']['Row']
type ReceiptItemRow = Database['public']['Tables']['receipt_items']['Row']

function buildReceiptRow(overrides?: Partial<ReceiptRow>): ReceiptRow {
  return {
    id: 'rec-1',
    org_id: 'org-1',
    location_id: 'loc-1',
    cashier_session_id: 'session-1',
    operator_id: 'op-1',
    contact_id: null,
    document_number: 'REC0001',
    payment_method: 'mobile_money',
    currency: 'XOF',
    subtotal: 10000,
    tax_amount: 1800,
    total: 11800,
    amount_paid: 12000,
    change_due: 200,
    notes: null,
    is_cancelled: false,
    cancelled_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildReceiptItemRow(overrides?: Partial<ReceiptItemRow>): ReceiptItemRow {
  return {
    id: 'ri-1',
    receipt_id: 'rec-1',
    product_id: 'prod-1',
    product_name: 'Piment',
    quantity: 5,
    unit_price: 2000,
    discount_amount: 0,
    tax_amount: 1800,
    total: 10000,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildOrgRow(): Database['public']['Tables']['organizations']['Row'] {
  return {
    id: 'org-1',
    name: 'Test Org',
    slug: 'test-org',
    country: 'SN',
    currency: 'XOF',
    timezone: 'Africa/Dakar',
    is_active: true,
    is_suspended: false,
    suspension_reason: null,
    onboarding_completed: true,
    has_cashier_enabled: true,
    has_storefront_enabled: false,
    has_api_enabled: false,
    storefront_location_id: null,
    has_invoicing_enabled: true,
    has_tax_enabled: true,
    tax_name: 'TVA',
    tax_rate: 18,
    tax_id: null,
    invoice_prefix: 'FA',
    quote_prefix: 'DEV',
    delivery_note_prefix: 'BL',
    receipt_prefix: 'REC',
    legal_mentions: null,
    auto_reminder_enabled: false,
    auto_reminder_days: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

describe('receiptService integration', () => {
  it('delegates receipt creation to the server-side completeSale path', async () => {
    const completeSaleMock = completeSale as unknown as ReturnType<typeof vi.fn>
    completeSaleMock.mockResolvedValue({
      id: 'rec-1',
      paymentMethod: 'mobile_money',
      total: 11800,
      items: [buildReceiptItemRow()],
    })

    const result = await createReceipt({
      orgId: 'org-1',
      locationId: 'loc-1',
      cashierSessionId: 'session-1',
      operatorId: 'op-1',
      paymentMethod: 'mobile_money',
      currency: 'XOF',
      subtotal: 10000,
      taxAmount: 1800,
      total: 11800,
      amountPaid: 12000,
      changeDue: 200,
      items: [
        {
          productId: 'prod-1',
          productName: 'Piment',
          quantity: 5,
          unitPrice: 2000,
          discountAmount: 0,
          taxAmount: 1800,
          total: 10000,
        },
      ],
    })

    expect(completeSaleMock).toHaveBeenCalledWith({
      locationId: 'loc-1',
      cashierSessionId: 'session-1',
      contactId: undefined,
      paymentMethod: 'mobile_money',
      currency: 'XOF',
      prefix: undefined,
      amountPaid: 12000,
      changeDue: 200,
      total: 11800,
      subtotal: 10000,
      taxAmount: 1800,
      notes: undefined,
      items: [
        {
          productId: 'prod-1',
          productName: 'Piment',
          quantity: 5,
          unitPrice: 2000,
          discountAmount: 0,
          taxAmount: 1800,
          total: 10000,
        },
      ],
    })
    expect(result.paymentMethod).toBe('mobile_money')
    expect(result.total).toBe(11800)
    expect(result.items).toHaveLength(1)
  })

  it('maps a receipt row and coerces nullable operator / payment defaults', async () => {
    const { supabase } = await import('@/services/supabase')

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'receipts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: buildReceiptRow({
                  operator_id: null,
                  payment_method: null,
                }),
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'receipt_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [buildReceiptItemRow()],
              error: null,
            }),
          }),
        }
      }
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: buildOrgRow(),
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock)

    const { receipt } = await getReceiptWithOrg('rec-1')

    expect(receipt.paymentMethod).toBe('other')
    expect(receipt.operatorId).toBe('')
  })
})
