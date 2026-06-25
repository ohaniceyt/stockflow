import { supabase } from '@/services/supabase'
import type { Organization } from '@/types'

export interface UpdateOrganizationInput {
  name: string
  slug: string
  currency: string
  timezone: string
}

export async function fetchOrganization(orgId: string): Promise<Organization> {
  if (!orgId) throw new Error('Organisation manquante')

  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, name, slug, currency, timezone, is_active, is_suspended, suspension_reason, created_at, updated_at'
    )
    .eq('id', orgId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (error || !data) throw new Error(error?.message ?? 'Organisation non trouvée')

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    currency: data.currency,
    timezone: data.timezone,
    isActive: data.is_active,
    isSuspended: data.is_suspended,
    suspensionReason: data.suspension_reason,
    onboardingCompleted: true,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  if (!orgId) throw new Error('Organisation manquante')

  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      currency: input.currency,
      timezone: input.timezone,
    })
    .eq('id', orgId)
    .select(
      'id, name, slug, currency, timezone, is_active, is_suspended, suspension_reason, created_at, updated_at'
    )
    .single()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (error || !data) throw new Error(error?.message ?? 'Mise à jour échouée')

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    currency: data.currency,
    timezone: data.timezone,
    isActive: data.is_active,
    isSuspended: data.is_suspended,
    suspensionReason: data.suspension_reason,
    onboardingCompleted: true,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
