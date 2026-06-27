import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface ListQuery {
  search?: string
  planId?: string
  status?: 'active' | 'suspended' | 'all'
  limit?: number
  offset?: number
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

    const platformAdmin = await requirePlatformAdmin(req, adminClient)
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const search = url.searchParams.get('search') ?? undefined
    const planId = url.searchParams.get('planId') ?? undefined
    const status = (url.searchParams.get('status') as ListQuery['status']) ?? 'all'
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

    let query = adminClient.from('organizations').select(
      `
        id,
        name,
        slug,
        currency,
        timezone,
        is_active,
        is_suspended,
        suspension_reason,
        onboarding_completed,
        created_at,
        updated_at,
        subscriptions ( plan_id, status, current_period_ends_at ),
        organization_memberships ( count )
      `,
      { count: 'exact' }
    )

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    if (status === 'active') {
      query = query.eq('is_suspended', false).eq('is_active', true)
    } else if (status === 'suspended') {
      query = query.eq('is_suspended', true)
    }

    if (planId) {
      query = query.eq('subscriptions.plan_id', planId)
    }

    const {
      data: organizations,
      error,
      count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const rows = (organizations ?? []).map((org) => {
      const memberships = org.organization_memberships as unknown as { count: number }[]
      return {
        ...(org as Record<string, unknown>),
        users_count: memberships?.[0]?.count ?? 0,
      }
    })

    return new Response(JSON.stringify({ organizations: rows, total: count ?? 0, limit, offset }), {
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
