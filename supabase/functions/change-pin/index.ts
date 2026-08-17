import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody, isNonEmptyString, isUuid } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface Payload {
  // Optional: the membership being acted on. When present and valid, the
  // admin-forced reset flag (force_pin_change) is cleared on that membership so
  // subsequent org switches no longer redirect to /change-pin. Tolerated when
  // absent for backward compatibility with older frontends.
  membershipId?: unknown
  newPin: unknown
}

function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

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

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) {
      return parsed.response
    }

    const { membershipId, newPin } = parsed.body
    if (!isNonEmptyString(newPin, 8) || !isValidPin(newPin)) {
      return new Response(JSON.stringify({ error: 'PIN must be 4 to 8 digits' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // The AppLock PIN is stored locally on the device (IndexedDB). This endpoint
    // only validates that the user is authenticated and the new PIN format is
    // acceptable. The actual PIN hash is persisted in IndexedDB by the frontend.
    //
    // Additionally, when membershipId is supplied we clear the admin-forced
    // reset flag (force_pin_change) on the caller's membership. Without this,
    // the flag set by request-pin-reset stays true forever in the DB (the
    // frontend only clears it in local session state), so every switch-membership
    // re-reads force_pin_change=true and RequireAuth redirects to /change-pin
    // again. Ownership is asserted via user_id; a mismatched id updates 0 rows
    // and is reported as 403.
    if (membershipId !== undefined && membershipId !== null) {
      if (!isUuid(membershipId)) {
        return new Response(JSON.stringify({ error: 'membershipId must be a valid UUID' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: updated, error: updateError } = await adminClient
        .from('organization_memberships')
        .update({ force_pin_change: false, updated_at: new Date().toISOString() })
        .eq('id', membershipId as string)
        .eq('user_id', claims.sub)
        .select('id')

      if (updateError) {
        console.error('change-pin: failed to clear force_pin_change', updateError)
        return genericInternalErrorResponse(req)
      }
      if (!updated || updated.length === 0) {
        // membershipId does not belong to the authenticated user.
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
