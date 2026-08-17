import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
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
    const rawAction = url.searchParams.get('action') ?? undefined
    const rawTargetType = url.searchParams.get('targetType') ?? undefined
    const rawTargetId = url.searchParams.get('targetId') ?? undefined
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

    let query = adminClient.from('platform_audit_logs').select('*', { count: 'exact' })

    if (rawAction) query = query.eq('action', rawAction)
    if (rawTargetType) query = query.eq('target_type', rawTargetType)
    if (rawTargetId) query = query.eq('target_id', rawTargetId)

    const {
      data: logs,
      error,
      count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    if (error) {
      return genericInternalErrorResponse(req)
    }

    return new Response(JSON.stringify({ logs: logs ?? [], total: count ?? 0, limit, offset }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
