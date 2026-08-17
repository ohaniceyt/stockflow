import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { logActivity } from '../_shared/audit.ts'
import { getLogger, getTraceId } from '../_shared/logger.ts'
import { parseJsonBody, isEnum, isString } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface DataSubjectRequestPayload {
  request_type: 'access' | 'deletion' | 'portability' | 'rectification'
  details?: string | null
}

const REQUEST_TYPES = ['access', 'deletion', 'portability', 'rectification'] as const

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
        return genericInternalErrorResponse(req)
      }

      return new Response(JSON.stringify({ requests: data }), {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'POST') {
      const parsed = await parseJsonBody<DataSubjectRequestPayload>(req)
      if (!parsed.ok) {
        return parsed.response
      }
      const { request_type, details } = parsed.body

      if (!isEnum(request_type, REQUEST_TYPES)) {
        return new Response(JSON.stringify({ error: 'Invalid request type' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }

      if (details !== undefined && details !== null && !isString(details, 2000)) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }

      const { data, error } = await adminClient
        .from('data_subject_requests')
        .insert({
          org_id: operator.org_id,
          user_id: claims.sub,
          request_type: request_type,
          details: details ? { note: details } : null,
        })
        .select()
        .single()

      if (error || !data) {
        log.error(
          'create_data_subject_request_failed',
          { org_id: operator.org_id, user_id: claims.sub },
          error ?? undefined
        )
        return genericInternalErrorResponse(req)
      }

      await logActivity(adminClient, {
        org_id: operator.org_id,
        actor_id: claims.sub,
        action: 'data_subject_request_created',
        target_type: 'data_subject_request',
        target_id: data.id,
        details: { request_type: request_type },
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })

      log.info('data_subject_request_created', {
        org_id: operator.org_id,
        user_id: claims.sub,
        request_id: data.id,
        request_type: request_type,
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
  } catch (_err) {
    const logErr = _err instanceof Error ? _err : new Error(String(_err))
    log.error('data_subject_request_unhandled_error', {}, logErr)
    return genericInternalErrorResponse(req)
  }
})
