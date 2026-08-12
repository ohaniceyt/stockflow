import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { clampInt, isNonEmptyString, isUuid } from '../_shared/validate.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return genericInternalErrorResponse(req)
    }

    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const claims = await verifyToken(supabaseUrl, anonKey, token)
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const membership = await getCurrentMembership(adminClient, claims.sub)
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Organization membership not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!['super_admin', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const rawAction = url.searchParams.get('action') ?? undefined
    const rawTargetType = url.searchParams.get('targetType') ?? undefined
    const rawTargetId = url.searchParams.get('targetId') ?? undefined
    const rawDateFrom = url.searchParams.get('dateFrom') ?? undefined
    const rawDateTo = url.searchParams.get('dateTo') ?? undefined
    const limit = clampInt(url.searchParams.get('limit'), 1, 200, 50)
    const offset = clampInt(url.searchParams.get('offset'), 0, Number.MAX_SAFE_INTEGER, 0)

    if (rawAction !== undefined && !isNonEmptyString(rawAction, 100)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (rawTargetType !== undefined && !isNonEmptyString(rawTargetType, 100)) {
      return new Response(JSON.stringify({ error: 'Invalid targetType' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (rawTargetId !== undefined && !isUuid(rawTargetId)) {
      return new Response(JSON.stringify({ error: 'Invalid targetId' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (rawDateFrom !== undefined && Number.isNaN(Date.parse(rawDateFrom))) {
      return new Response(JSON.stringify({ error: 'Invalid dateFrom' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (rawDateTo !== undefined && Number.isNaN(Date.parse(rawDateTo))) {
      return new Response(JSON.stringify({ error: 'Invalid dateTo' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    let query = adminClient
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .eq('org_id', membership.org_id)

    if (rawAction) query = query.eq('action', rawAction)
    if (rawTargetType) query = query.eq('target_type', rawTargetType)
    if (rawTargetId) query = query.eq('target_id', rawTargetId)
    if (rawDateFrom) query = query.gte('created_at', new Date(rawDateFrom).toISOString())
    if (rawDateTo) query = query.lte('created_at', new Date(rawDateTo).toISOString())

    const {
      data: logs,
      error,
      count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    if (error) {
      console.error('list-org-activity-logs query error', error)
      return genericInternalErrorResponse(req)
    }

    return new Response(JSON.stringify({ logs: logs ?? [], total: count ?? 0, limit, offset }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('list-org-activity-logs uncaught error', err)
    return genericInternalErrorResponse(req)
  }
})
