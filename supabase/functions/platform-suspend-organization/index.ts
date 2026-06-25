import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'

interface Payload {
  orgId: string
  isSuspended: boolean
  reason?: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-platform-challenge-id',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { orgId, isSuspended, reason }: Payload = await req.json()
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error } = await adminClient
      .from('organizations')
      .update({
        is_suspended: isSuspended,
        suspension_reason: isSuspended ? (reason ?? null) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await adminClient.from('platform_audit_logs').insert({
      actor_id: platformAdmin.authUserId,
      actor_role: platformAdmin.role,
      action: isSuspended ? 'org_suspended' : 'org_reactivated',
      target_type: 'organization',
      target_id: orgId,
      metadata: { reason },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Organization ${isSuspended ? 'suspended' : 'reactivated'}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
