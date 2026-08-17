import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody, isUuid, isBoolean } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

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

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) return parsed.response

    if (!isUuid(parsed.body.membershipId)) {
      return new Response(JSON.stringify({ error: 'membershipId must be a valid UUID' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!isBoolean(parsed.body.isActive)) {
      return new Response(JSON.stringify({ error: 'isActive must be a boolean' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('organization_memberships')
      .select('id, user_id, org_id, role')
      .eq('id', parsed.body.membershipId)
      .single()

    if (membershipError) {
      return genericInternalErrorResponse(req)
    }
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Membership not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
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
      .update({ is_active: parsed.body.isActive, updated_at: new Date().toISOString() })
      .eq('id', parsed.body.membershipId)

    if (updateError) {
      return genericInternalErrorResponse(req)
    }

    await adminClient.from('platform_audit_logs').insert({
      actor_id: platformAdmin.authUserId,
      actor_role: platformAdmin.role,
      action: parsed.body.isActive ? 'user_activated' : 'user_deactivated',
      target_type: 'membership',
      target_id: parsed.body.membershipId,
      metadata: { userId: membership.user_id, orgId: membership.org_id, role: membership.role },
    })

    return new Response(JSON.stringify({ success: true, isActive: parsed.body.isActive }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
