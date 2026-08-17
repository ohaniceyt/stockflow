import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody, isUuid, isBoolean, isNonEmptyString } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface Payload {
  orgId: string
  isSuspended: boolean
  reason?: string
}

const REASON_MAX_LENGTH = 500

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

    const platformAdmin = await requirePlatformAdmin(req, adminClient, 'super_admin', true)
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) return parsed.response

    if (!isUuid(parsed.body.orgId)) {
      return new Response(JSON.stringify({ error: 'orgId must be a valid UUID' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!isBoolean(parsed.body.isSuspended)) {
      return new Response(JSON.stringify({ error: 'isSuspended must be a boolean' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (
      parsed.body.reason !== undefined &&
      !isNonEmptyString(parsed.body.reason, REASON_MAX_LENGTH)
    ) {
      return new Response(
        JSON.stringify({ error: `reason must be a string up to ${REASON_MAX_LENGTH} characters` }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const { error } = await adminClient
      .from('organizations')
      .update({
        is_suspended: parsed.body.isSuspended,
        suspension_reason: parsed.body.isSuspended ? (parsed.body.reason ?? null) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.body.orgId)

    if (error) {
      return genericInternalErrorResponse(req)
    }

    await adminClient.from('platform_audit_logs').insert({
      actor_id: platformAdmin.authUserId,
      actor_role: platformAdmin.role,
      action: parsed.body.isSuspended ? 'org_suspended' : 'org_reactivated',
      target_type: 'organization',
      target_id: parsed.body.orgId,
      metadata: { reason: parsed.body.reason },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Organization ${parsed.body.isSuspended ? 'suspended' : 'reactivated'}`,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
