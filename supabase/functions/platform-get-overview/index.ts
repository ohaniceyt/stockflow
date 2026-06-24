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

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [
      orgsTotalRes,
      orgsActiveRes,
      usersTotalRes,
      usersOnlineRes,
      movementsTodayRes,
      plansRes,
      recentActivityRes,
    ] = await Promise.all([
      adminClient.from('organizations').select('*', { count: 'exact', head: true }),
      adminClient
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .eq('is_suspended', false),
      adminClient.from('users').select('*', { count: 'exact', head: true }),
      adminClient
        .from('organization_memberships')
        .select('*', { count: 'exact', head: true })
        .gte('last_login_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()),
      adminClient
        .from('movements')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      adminClient.from('subscriptions').select('plan_id'),
      adminClient
        .from('platform_audit_logs')
        .select('id, action, target_type, target_id, actor_role, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const plansDistribution: Record<string, number> = {}
    ;(plansRes.data ?? []).forEach((s) => {
      const key = (s as { plan_id: string }).plan_id
      plansDistribution[key] = (plansDistribution[key] ?? 0) + 1
    })

    return new Response(
      JSON.stringify({
        organizationsTotal: orgsTotalRes.count ?? 0,
        organizationsActive: orgsActiveRes.count ?? 0,
        usersTotal: usersTotalRes.count ?? 0,
        usersOnline: usersOnlineRes.count ?? 0,
        movementsToday: movementsTodayRes.count ?? 0,
        subscriptionsByPlan: plansDistribution,
        recentActivity: recentActivityRes.data ?? [],
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
