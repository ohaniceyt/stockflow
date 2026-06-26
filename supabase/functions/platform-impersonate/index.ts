import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface Payload {
  userId?: string
  orgId?: string
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

    const platformAdmin = await requirePlatformAdmin(req, adminClient, 'super_admin', true)
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { userId, orgId }: Payload = await req.json()
    if (!userId && !orgId) {
      return new Response(JSON.stringify({ error: 'userId or orgId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    let targetOrgId = orgId
    const targetUserId = userId

    if (userId && !orgId) {
      const { data: membership } = await adminClient
        .from('organization_memberships')
        .select('org_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!membership) {
        return new Response(JSON.stringify({ error: 'No active membership found for user' }), {
          status: 404,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      targetOrgId = membership.org_id
    }

    const { data: targetOrg, error: orgError } = await adminClient
      .from('organizations')
      .select('id, name, is_suspended, suspension_reason')
      .eq('id', targetOrgId)
      .single()

    if (orgError || !targetOrg || targetOrg.is_suspended) {
      return new Response(
        JSON.stringify({
          error:
            orgError?.message ??
            (targetOrg?.is_suspended ? 'Organization is suspended' : 'Organization not found'),
        }),
        {
          status: orgError ? 500 : 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    await adminClient.from('platform_audit_logs').insert({
      actor_id: platformAdmin.authUserId,
      actor_role: platformAdmin.role,
      action: 'sudo_enter',
      target_type: 'organization',
      target_id: targetOrgId,
      metadata: { targetUserId },
    })

    return new Response(
      JSON.stringify({
        success: true,
        sudoTarget: {
          type: 'organization',
          id: targetOrgId,
          name: targetOrg.name,
          targetUserId,
        },
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
