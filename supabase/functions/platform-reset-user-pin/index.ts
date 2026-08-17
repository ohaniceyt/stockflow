import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { isUuid, parseJsonBody } from '../_shared/validate.ts'

interface Payload {
  membershipId: string
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

    // Resetting a user's PIN is sensitive (account access); require a fresh 2FA
    // challenge even for moderators.
    const platformAdmin = await requirePlatformAdmin(req, adminClient, undefined, true)
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) return parsed.response
    const { membershipId } = parsed.body

    if (!isUuid(membershipId)) {
      return new Response(JSON.stringify({ error: 'membershipId must be a valid UUID' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('organization_memberships')
      .select('id, user_id, org_id, users!inner(email)')
      .eq('id', membershipId)
      .single()

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: 'Membership not found' }), {
        status: membershipError ? 500 : 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const userId = membership.user_id as string
    const orgId = membership.org_id as string
    const userEmail = (membership.users as { email: string }).email

    // Force a PIN change on next auth: the AppLock PIN lives client-side
    // (IndexedDB), so the server-side enforcement is the force_pin_change flag.
    // Setting it to true ensures the user MUST pick a new PIN after this reset
    // (the previous, possibly compromised PIN is no longer trusted).
    const { error: updateError } = await adminClient
      .from('organization_memberships')
      .update({ force_pin_change: true, updated_at: new Date().toISOString() })
      .eq('id', membershipId)

    if (updateError) {
      return genericInternalErrorResponse(req)
    }

    // Send a magic link so the user can set a new PIN through /auth/reset-pin.
    const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
    const { error: otpError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: { redirectTo: `${appUrl}/auth/reset-pin` },
    })

    if (otpError) {
      // We still succeeded at forcing the PIN change; log the email failure.
      console.error('Failed to send PIN reset magic link', otpError)
    }

    await adminClient.from('platform_audit_logs').insert({
      actor_id: platformAdmin.authUserId,
      actor_role: platformAdmin.role,
      action: 'user_pin_reset',
      target_type: 'membership',
      target_id: membershipId,
      metadata: { userId, orgId, emailSent: !otpError },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: otpError
          ? 'PIN cleared but email could not be sent'
          : 'PIN reset. A magic link was sent to the user.',
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
