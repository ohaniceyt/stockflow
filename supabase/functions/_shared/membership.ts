import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

export interface Membership {
  id: string
  org_id: string
  user_id: string
  role: 'super_admin' | 'admin' | 'operator' | 'reader'
  pin_hash: string | null
  is_active: boolean
  force_pin_change: boolean
  last_login_at: string | null
}

export async function getCurrentOrgId(
  adminClient: ReturnType<typeof createClient>,
  authUserId: string
): Promise<string | null> {
  const { data } = await adminClient
    .from('users')
    .select('active_org_id')
    .eq('id', authUserId)
    .maybeSingle()
  return data?.active_org_id ?? null
}

export async function getCurrentMembership(
  adminClient: ReturnType<typeof createClient>,
  authUserId: string
): Promise<Membership | null> {
  const activeOrgId = await getCurrentOrgId(adminClient, authUserId)
  if (!activeOrgId) return null

  const { data, error } = await adminClient
    .from('organization_memberships')
    .select('id, org_id, user_id, role, pin_hash, is_active, force_pin_change, last_login_at')
    .eq('user_id', authUserId)
    .eq('org_id', activeOrgId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data as unknown as Membership
}

export function membershipResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
