import { describe, it, expect, vi } from 'vitest'

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({})),
    rpc: vi.fn(),
  },
}))

import { convertQuoteToInvoice, recordPayment } from '@/features/invoicing/services/invoiceService'

describe('invoiceService integration', () => {
  it('converts a quote and passes undefined dates when omitted', async () => {
    const { supabase } = await import('@/services/supabase')
    const rpcMock = vi.fn().mockResolvedValue({ data: 'inv-1', error: null })
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockImplementation(rpcMock)

    const result = await convertQuoteToInvoice('quote-1')

    expect(result).toBe('inv-1')
    expect(rpcMock).toHaveBeenCalledWith('convert_quote_to_invoice', {
      p_quote_id: 'quote-1',
      p_issue_date: undefined,
      p_due_date: undefined,
    })
  })

  it('records a payment without sending null for optional fields', async () => {
    const { supabase } = await import('@/services/supabase')
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockImplementation(rpcMock)

    await recordPayment('inv-1', 5000, 'mobile_money', 'ref-123')

    expect(rpcMock).toHaveBeenCalledWith('record_invoice_payment', {
      p_invoice_id: 'inv-1',
      p_amount: 5000,
      p_payment_method: 'mobile_money',
      p_reference: 'ref-123',
      p_paid_at: undefined,
    })
  })
})
