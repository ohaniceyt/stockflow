import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { clampInt, isEnum, isSafeSearchTerm, isUuid } from '../_shared/validate.ts'

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
    const rawSearch = url.searchParams.get('search') ?? undefined
    const rawPlanId = url.searchParams.get('planId') ?? undefined
    const rawStatus = (url.searchParams.get('status') as ListQuery['status']) ?? 'all'
    const limit = clampInt(url.searchParams.get('limit'), 1, 100, 20)
    const offset = clampInt(url.searchParams.get('offset'), 0, Number.MAX_SAFE_INTEGER, 0)

    const search = rawSearch ? rawSearch.trim() : undefined
    if (search !== undefined && !isSafeSearchTerm(search)) {
      return new Response(JSON.stringify({ error: 'Invalid search term' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (rawPlanId !== undefined && !isUuid(rawPlanId)) {
      return new Response(JSON.stringify({ error: 'Invalid planId' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const allowedStatuses = ['active', 'suspended', 'all'] as const
    if (!isEnum(rawStatus, allowedStatuses)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    const status = rawStatus

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

    if (rawPlanId !== undefined) {
      query = query.eq('subscriptions.plan_id', rawPlanId)
    }

    const {
      data: organizations,
      error,
      count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    if (error) {
      return genericInternalErrorResponse(req)
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
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
