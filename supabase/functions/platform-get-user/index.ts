import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const platformAdmin = await requirePlatformAdmin(req, adminClient)
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: user, error: userError } = await adminClient
      .from('users')
      .select(
        `
        id,
        name,
        email,
        phone,
        email_verified,
        active_org_id,
        created_at,
        updated_at,
        organization_memberships (
          id,
          org_id,
          role,
          is_active,
          force_pin_change,
          last_login_at,
          created_at,
          organizations ( id, name )
        )
      `
      )
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: userError?.message ?? 'User not found' }), {
        status: userError?.code === 'PGRST116' ? 404 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: recentActivity } = await adminClient
      .from('activity_logs')
      .select('id, action, target_type, target_id, details, created_at')
      .eq('actor_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    const { data: authAudit } = await adminClient
      .from('login_attempts')
      .select('succeeded, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    return new Response(
      JSON.stringify({
        user,
        recentActivity: recentActivity ?? [],
        loginAttempts: authAudit ?? [],
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
