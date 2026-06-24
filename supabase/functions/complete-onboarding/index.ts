import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'

interface OnboardingPayload {
  orgName: string
  currency: string
  timezone: string
  defaultLocationName: string
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

    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claims = parseJwt(token)
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { orgName, currency, timezone, defaultLocationName }: OnboardingPayload = await req.json()
    if (!orgName?.trim() || !currency || !timezone || !defaultLocationName?.trim()) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Reject onboarding if the user's email is not verified.
    const { data: authUser, error: authUserError } =
      await adminClient.auth.admin.getUserById(authUserId)
    if (authUserError || !authUser.user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!authUser.user.email_confirmed_at) {
      return new Response(JSON.stringify({ error: 'Email not verified' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const authUserId = claims.sub

    // Refuse if the user already has an active organization/membership.
    const { data: existingMembership } = await adminClient
      .from('organization_memberships')
      .select('id')
      .eq('user_id', authUserId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (existingMembership) {
      return new Response(
        JSON.stringify({
          error:
            'User already belongs to an organization. Onboarding is only available for new accounts without an organization.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Refuse if the user already has an active organization/membership.
    const { data: existingMembership } = await adminClient
      .from('organization_memberships')
      .select('id')
      .eq('user_id', authUserId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (existingMembership) {
      return new Response(
        JSON.stringify({
          error:
            'User already belongs to an organization. Onboarding is only available for new accounts without an organization.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atomic onboarding via RPC: creates org, super_admin membership, free subscription and default location.
    const { data: rpcData, error: rpcError } = await adminClient.rpc('complete_onboarding', {
      p_user_id: authUserId,
      p_org_name: orgName.trim(),
      p_currency: currency,
      p_timezone: timezone,
      p_default_location_name: defaultLocationName.trim(),
    })

    if (rpcError) {
      let status = 500
      if (rpcError.message?.includes('organizations_name_unique')) status = 409
      return new Response(
        JSON.stringify({
          error: rpcError.message,
          code: rpcError.code,
        }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Onboarding terminé', orgId: rpcData }),
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
