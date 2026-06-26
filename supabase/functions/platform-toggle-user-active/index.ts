import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface Payload {
  membershipId: string
  isActive: boolean
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env vars')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Moderators may disable a user for support reasons, but only super_admins can re-enable or disable owners.
    const platformAdmin = await requirePlatformAdmin(req, adminClient)
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { membershipId, isActive }: Payload = await req.json()
    if (!membershipId || typeof isActive !== 'boolean') {
      return new Response(JSON.stringify({ error: 'membershipId and isActive required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('organization_memberships')
      .select('id, user_id, org_id, role')
      .eq('id', membershipId)
      .single()

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: membershipError?.message ?? 'Membership not found' }),
        {
          status: membershipError ? 500 : 404,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    if (membership.role === 'super_admin' && platformAdmin.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Only super admins can toggle organization owners' }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const { error: updateError } = await adminClient
      .from('organization_memberships')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', membershipId)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    await adminClient.from('platform_audit_logs').insert({
      actor_id: platformAdmin.authUserId,
      actor_role: platformAdmin.role,
      action: isActive ? 'user_activated' : 'user_deactivated',
      target_type: 'membership',
      target_id: membershipId,
      metadata: { userId: membership.user_id, orgId: membership.org_id, role: membership.role },
    })

    return new Response(JSON.stringify({ success: true, isActive }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
