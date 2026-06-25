import { supabase } from '@/services/supabase'
import type { Organization } from '@/types'
import type { Database } from '@/types/database'

export interface UpdateOrganizationInput {
  name: string
  slug: string
  currency: string
  timezone: string
  hasCashierEnabled?: boolean
  hasStorefrontEnabled?: boolean
  hasApiEnabled?: boolean
  storefrontLocationId?: string | null
}

function mapOrganizationRow(data: {
  id: string
  name: string
  slug: string
  currency: string
  timezone: string
  is_active: boolean
  is_suspended: boolean
  suspension_reason: string | null
  onboarding_completed: boolean
  has_cashier_enabled: boolean
  has_storefront_enabled: boolean
  has_api_enabled: boolean
  storefront_location_id: string | null
  created_at: string
  updated_at: string
}): Organization {
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    currency: data.currency,
    timezone: data.timezone,
    isActive: data.is_active,
    isSuspended: data.is_suspended,
    suspensionReason: data.suspension_reason,
    onboardingCompleted: data.onboarding_completed,
    hasCashierEnabled: data.has_cashier_enabled,
    hasStorefrontEnabled: data.has_storefront_enabled,
    hasApiEnabled: data.has_api_enabled,
    storefrontLocationId: data.storefront_location_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function fetchOrganization(orgId: string): Promise<Organization> {
  if (!orgId) throw new Error('Organisation manquante')

  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, name, slug, currency, timezone, is_active, is_suspended, suspension_reason, onboarding_completed, has_cashier_enabled, has_storefront_enabled, has_api_enabled, storefront_location_id, created_at, updated_at'
    )
    .eq('id', orgId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (error || !data) throw new Error(error?.message ?? 'Organisation non trouvée')

  return mapOrganizationRow(data)
}

export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  if (!orgId) throw new Error('Organisation manquante')

  const updateData: Database['public']['Tables']['organizations']['Update'] = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    currency: input.currency,
    timezone: input.timezone,
  }
  if (input.hasCashierEnabled !== undefined) {
    updateData.has_cashier_enabled = input.hasCashierEnabled
  }
  if (input.hasStorefrontEnabled !== undefined) {
    updateData.has_storefront_enabled = input.hasStorefrontEnabled
  }
  if (input.hasApiEnabled !== undefined) {
    updateData.has_api_enabled = input.hasApiEnabled
  }
  if (input.storefrontLocationId !== undefined) {
    updateData.storefront_location_id = input.storefrontLocationId ?? null
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(updateData)
    .eq('id', orgId)
    .select(
      'id, name, slug, currency, timezone, is_active, is_suspended, suspension_reason, onboarding_completed, has_cashier_enabled, has_storefront_enabled, has_api_enabled, storefront_location_id, created_at, updated_at'
    )
    .single()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (error || !data) throw new Error(error?.message ?? 'Mise à jour échouée')

  return mapOrganizationRow(data)
}
