import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { parseJsonBody, isUuid } from '../_shared/validate.ts'

interface Payload {
  client_operation_id: string
  type: string
  payload: Record<string, unknown>
  status?: 'pending' | 'syncing' | 'failed' | 'dead'
  retry_count?: number
  error?: string | null
  next_retry_at?: string | null
}

const ALLOWED_TYPES = [
  'MOVEMENT',
  'PRODUCT_CREATE',
  'PRODUCT_UPDATE',
  'CONTACT_CREATE',
  'CONTACT_UPDATE',
  'LOCATION_CREATE',
  'LOCATION_UPDATE',
  'LOCATION_SET_DEFAULT',
  'CATEGORY_CREATE',
  'CATEGORY_UPDATE',
  'CATEGORY_DELETE',
  'INVENTORY',
  'INVENTORY_COUNT_UPDATE',
  'INVENTORY_SESSION_CREATE',
]

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

    const parseResult = await parseJsonBody<Payload>(req)
    if (!parseResult.ok) {
      return parseResult.response
    }

    const body = parseResult.body
    if (!isUuid(body.client_operation_id)) {
      return new Response(JSON.stringify({ error: 'client_operation_id must be a valid UUID' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!ALLOWED_TYPES.includes(body.type)) {
      return new Response(JSON.stringify({ error: 'Operation type not allowed' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const status = body.status ?? 'pending'
    if (!['pending', 'syncing', 'failed', 'dead'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const nextRetryAt = body.next_retry_at ? new Date(body.next_retry_at) : null
    if (body.next_retry_at && Number.isNaN(nextRetryAt?.getTime() ?? 0)) {
      return new Response(JSON.stringify({ error: 'Invalid next_retry_at' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { error } = await adminClient.rpc('upsert_org_pending_operation', {
      p_client_operation_id: body.client_operation_id,
      p_org_id: membership.org_id,
      p_actor_id: claims.sub,
      p_type: body.type,
      p_payload: body.payload,
      p_status: status,
      p_retry_count: body.retry_count ?? 0,
      p_error: body.error ?? null,
      p_next_retry_at: nextRetryAt?.toISOString() ?? null,
    })

    if (error) {
      console.error('queue-org-operation rpc error', error)
      return genericInternalErrorResponse(req)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('queue-org-operation uncaught error', err)
    return genericInternalErrorResponse(req)
  }
})
