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
    const search = url.searchParams.get('search') ?? undefined
    const orgId = url.searchParams.get('orgId') ?? undefined
    const role = url.searchParams.get('role') ?? undefined
    const isActive = url.searchParams.get('isActive')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

    let query = adminClient.from('users').select(
      `
        id,
        name,
        email,
        phone,
        email_verified,
        active_org_id,
        created_at,
        updated_at,
        organization_memberships!inner (
          id,
          org_id,
          role,
          is_active,
          force_pin_change,
          last_login_at,
          organizations!inner ( id, name )
        )
      `,
      { count: 'exact' }
    )

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (orgId) {
      query = query.eq('organization_memberships.org_id', orgId)
    }

    if (role) {
      query = query.eq('organization_memberships.role', role)
    }

    if (isActive === 'true' || isActive === 'false') {
      query = query.eq('organization_memberships.is_active', isActive === 'true')
    }

    const {
      data: users,
      error,
      count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ users: users ?? [], total: count ?? 0, limit, offset }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
