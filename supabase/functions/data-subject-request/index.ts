import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { logActivity } from '../_shared/audit.ts'
import { getLogger, getTraceId } from '../_shared/logger.ts'

interface DataSubjectRequestPayload {
  request_type: 'access' | 'deletion' | 'portability' | 'rectification'
  details?: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  const traceId = getTraceId(req)
  const log = getLogger('data-subject-request', traceId)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing Supabase env vars')
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

    const operator = await getCurrentMembership(adminClient, claims.sub)
    if (!operator) {
      return new Response(JSON.stringify({ error: 'Operator not found' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'GET') {
      const { data, error } = await adminClient
        .from('data_subject_requests')
        .select('*')
        .eq('org_id', operator.org_id)
        .eq('user_id', claims.sub)
        .order('requested_at', { ascending: false })

      if (error) {
        log.error(
          'list_data_subject_requests_failed',
          { org_id: operator.org_id, user_id: claims.sub },
          error
        )
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ requests: data }), {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'POST') {
      const payload: DataSubjectRequestPayload = await req.json()
      if (!['access', 'deletion', 'portability', 'rectification'].includes(payload.request_type)) {
        return new Response(JSON.stringify({ error: 'Invalid request type' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }

      const { data, error } = await adminClient
        .from('data_subject_requests')
        .insert({
          org_id: operator.org_id,
          user_id: claims.sub,
          request_type: payload.request_type,
          details: payload.details ? { note: payload.details } : null,
        })
        .select()
        .single()

      if (error || !data) {
        log.error(
          'create_data_subject_request_failed',
          { org_id: operator.org_id, user_id: claims.sub },
          error ?? undefined
        )
        return new Response(
          JSON.stringify({ error: error?.message ?? 'Failed to create request' }),
          {
            status: 500,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        )
      }

      await logActivity(adminClient, {
        org_id: operator.org_id,
        actor_id: claims.sub,
        action: 'data_subject_request_created',
        target_type: 'data_subject_request',
        target_id: data.id,
        details: { request_type: payload.request_type },
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })

      log.info('data_subject_request_created', {
        org_id: operator.org_id,
        user_id: claims.sub,
        request_id: data.id,
        request_type: payload.request_type,
      })

      return new Response(JSON.stringify({ request: data }), {
        status: 201,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error(
      'data_subject_request_unhandled_error',
      {},
      err instanceof Error ? err : new Error(message)
    )
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
