import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
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
    const orgId = url.searchParams.get('orgId')
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'orgId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select(
        `
        id,
        name,
        currency,
        timezone,
        is_active,
        is_suspended,
        suspension_reason,
        onboarding_completed,
        created_at,
        updated_at,
        subscriptions ( plan_id, status, current_period_ends_at, trial_ends_at, stripe_customer_id, stripe_subscription_id ),
        organization_memberships ( count )
      `
      )
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: orgError?.message ?? 'Organization not found' }),
        {
          status: orgError?.code === 'PGRST116' ? 404 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { data: recentActivity } = await adminClient
      .from('activity_logs')
      .select('id, action, actor_id, target_type, target_id, details, created_at, users!left(name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50)

    const { count: productsCount } = await adminClient
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)

    const { count: locationsCount } = await adminClient
      .from('locations')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)

    const memberships = org.organization_memberships as unknown as { count: number }[]

    return new Response(
      JSON.stringify({
        organization: {
          ...(org as Record<string, unknown>),
          users_count: memberships?.[0]?.count ?? 0,
          products_count: productsCount ?? 0,
          locations_count: locationsCount ?? 0,
        },
        recentActivity: recentActivity ?? [],
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
