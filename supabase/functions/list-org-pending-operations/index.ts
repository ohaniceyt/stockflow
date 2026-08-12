import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { clampInt, isEnum } from '../_shared/validate.ts'

const ALLOWED_STATUSES = ['pending', 'syncing', 'failed', 'dead', 'cancelled', 'completed'] as const

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
    const rawStatus = url.searchParams.get('status') ?? undefined
    const limit = clampInt(url.searchParams.get('limit'), 1, 200, 50)
    const offset = clampInt(url.searchParams.get('offset'), 0, Number.MAX_SAFE_INTEGER, 0)

    if (rawStatus !== undefined && !isEnum(rawStatus, ALLOWED_STATUSES)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    let query = adminClient
      .from('org_pending_operations')
      .select('*', { count: 'exact' })
      .eq('org_id', membership.org_id)

    if (rawStatus) query = query.eq('status', rawStatus)

    const {
      data: operations,
      error,
      count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    if (error) {
      console.error('list-org-pending-operations query error', error)
      return genericInternalErrorResponse(req)
    }

    return new Response(
      JSON.stringify({ operations: operations ?? [], total: count ?? 0, limit, offset }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('list-org-pending-operations uncaught error', err)
    return genericInternalErrorResponse(req)
  }
})
