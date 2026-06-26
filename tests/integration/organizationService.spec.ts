import { describe, it, expect, vi } from 'vitest'

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({})),
    rpc: vi.fn(),
  },
}))

import {
  mapOrganizationRow,
  updateOrganization,
} from '@/features/settings/services/organizationService'
import type { Organization } from '@/types'
import type { Database } from '@/types/database'

type OrgRow = Database['public']['Tables']['organizations']['Row']

function buildOrgRow(overrides?: Partial<OrgRow>): OrgRow {
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
    auto_reminder_enabled: true,
    auto_reminder_days: 7,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('organizationService integration', () => {
  it('maps a complete organization row to the app model', () => {
    const row = buildOrgRow()
    const org = mapOrganizationRow(row)

    expect(org).toEqual({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      country: 'SN',
      currency: 'XOF',
      timezone: 'Africa/Dakar',
      isActive: true,
      isSuspended: false,
      suspensionReason: null,
      onboardingCompleted: true,
      hasCashierEnabled: true,
      hasStorefrontEnabled: false,
      hasApiEnabled: false,
      storefrontLocationId: null,
      hasInvoicingEnabled: true,
      hasTaxEnabled: true,
      taxName: 'TVA',
      taxRate: 18,
      taxId: null,
      invoicePrefix: 'FA',
      quotePrefix: 'DEV',
      deliveryNotePrefix: 'BL',
      receiptPrefix: 'REC',
      legalMentions: null,
      autoReminderEnabled: true,
      autoReminderDays: 7,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    } satisfies Organization)
  })

  it('coerces nullable reminder defaults to safe values', () => {
    const row = buildOrgRow({
      auto_reminder_enabled: null,
      auto_reminder_days: null,
    })

    const org = mapOrganizationRow(row)

    expect(org.autoReminderEnabled).toBe(false)
    expect(org.autoReminderDays).toBeNull()
  })

  it('updateOrganization falls back to defaults for NOT NULL billing fields', async () => {
    const { supabase } = await import('@/services/supabase')
    const singleMock = vi.fn().mockResolvedValue({ data: buildOrgRow(), error: null })
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: singleMock,
        }),
      }),
    })
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: updateMock,
    })

    await updateOrganization('org-1', {
      name: 'Test Org',
      slug: 'test-org',
      country: 'SN',
      currency: 'XOF',
      timezone: 'Africa/Dakar',
      taxName: null,
      taxRate: null,
      taxId: null,
      invoicePrefix: null,
      quotePrefix: null,
      deliveryNotePrefix: null,
      receiptPrefix: null,
    })

    const updateData = updateMock.mock
      .calls[0][0] as Database['public']['Tables']['organizations']['Update']
    expect(updateData.tax_name).toBe('TVA')
    expect(updateData.tax_rate).toBe(0)
    expect(updateData.tax_id).toBe('')
    expect(updateData.invoice_prefix).toBe('FA')
    expect(updateData.quote_prefix).toBe('DEV')
    expect(updateData.delivery_note_prefix).toBe('BL')
    expect(updateData.receipt_prefix).toBe('REC')
  })
})
