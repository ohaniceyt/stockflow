import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'

interface Payload {
  membershipId: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { membershipId }: Payload = await req.json()
    if (!membershipId) {
      return new Response(JSON.stringify({ error: 'membershipId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('organization_memberships')
      .select('id, user_id, org_id, users!inner(email)')
      .eq('id', membershipId)
      .single()

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: membershipError?.message ?? 'Membership not found' }),
        {
          status: membershipError ? 500 : 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const userId = membership.user_id as string
    const orgId = membership.org_id as string
    const userEmail = (membership.users as { email: string }).email

    const { error: updateError } = await adminClient
      .from('organization_memberships')
      .update({ pin_hash: null, force_pin_change: false, updated_at: new Date().toISOString() })
      .eq('id', membershipId)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send a magic link so the user can set a new PIN through /auth/reset-pin.
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
    const { error: otpError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: { redirectTo: `${appUrl}/auth/reset-pin` },
    })

    if (otpError) {
      // We still succeeded at clearing the PIN; log the email failure.
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
