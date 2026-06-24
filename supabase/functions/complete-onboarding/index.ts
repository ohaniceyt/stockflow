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

    // Create the organization.
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .insert({
        name: orgName.trim(),
        currency,
        timezone,
        onboarding_completed: true,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: orgError?.message ?? 'Could not create organization' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin membership.
    const { data: membership, error: membershipError } = await adminClient
      .from('organization_memberships')
      .insert({
        org_id: org.id,
        user_id: authUserId,
        role: 'admin',
        pin_hash: null,
        is_active: true,
        force_pin_change: false,
      })
      .select('id')
      .single()

    if (membershipError || !membership) {
      await adminClient
        .from('organizations')
        .delete()
        .eq('id', org.id)
        .catch(() => {})
      return new Response(
        JSON.stringify({ error: membershipError?.message ?? 'Could not create membership' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create free subscription.
    const { error: subError } = await adminClient.from('subscriptions').insert({
      org_id: org.id,
      plan_id: 'free',
      status: 'active',
      billing_interval: 'month',
      current_period_starts_at: new Date().toISOString(),
      current_period_ends_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    })

    if (subError) {
      await adminClient
        .from('organization_memberships')
        .delete()
        .eq('id', membership.id)
        .catch(() => {})
      await adminClient
        .from('organizations')
        .delete()
        .eq('id', org.id)
        .catch(() => {})
      return new Response(JSON.stringify({ error: subError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create default location.
    const { error: locationError } = await adminClient.from('locations').insert({
      org_id: org.id,
      name: defaultLocationName.trim(),
      description: 'Emplacement par défaut créé lors de l’onboarding',
      is_default: true,
    })

    if (locationError) {
      await adminClient
        .from('subscriptions')
        .delete()
        .eq('org_id', org.id)
        .catch(() => {})
      await adminClient
        .from('organization_memberships')
        .delete()
        .eq('id', membership.id)
        .catch(() => {})
      await adminClient
        .from('organizations')
        .delete()
        .eq('id', org.id)
        .catch(() => {})
      return new Response(JSON.stringify({ error: locationError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Activate the new org for the user.
    await adminClient.from('users').update({ active_org_id: org.id }).eq('id', authUserId)

    return new Response(
      JSON.stringify({ success: true, message: 'Onboarding terminé', orgId: org.id }),
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
