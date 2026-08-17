import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody, isNonEmptyString } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface Payload {
  token: string
}

const TOKEN_MAX_LENGTH = 256

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

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) return parsed.response

    if (!isNonEmptyString(parsed.body.token, TOKEN_MAX_LENGTH)) {
      return new Response(JSON.stringify({ valid: false, error: 'Token required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: invitation, error } = await adminClient
      .from('invitations')
      .select('id, org_id, email, role, expires_at, status, organizations!inner(name)')
      .eq('token', parsed.body.token)
      .single()

    if (error || !invitation) {
      return new Response(JSON.stringify({ valid: false, error: 'Invitation not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (invitation.status !== 'pending') {
      return new Response(
        JSON.stringify({ valid: false, error: `Invitation already ${invitation.status}` }),
        { status: 410, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    if (invitation.expires_at && new Date(invitation.expires_at as string) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: 'Invitation expired' }), {
        status: 410,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const org = invitation.organizations as unknown as { name: string }

    return new Response(
      JSON.stringify({
        valid: true,
        invitationId: invitation.id,
        orgId: invitation.org_id,
        orgName: org.name,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expires_at,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
