import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'

interface OnboardingPayload {
  orgName: string
  orgSlug: string
  currency: string
  timezone: string
  defaultLocationName: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

function isValidSlug(value: string): boolean {
  return /^[a-z0-9-]+$/.test(value) && value.length >= 2 && value.length <= 50
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

    const { orgName, orgSlug, currency, timezone, defaultLocationName }: OnboardingPayload =
      await req.json()

    if (
      !orgName?.trim() ||
      !orgSlug?.trim() ||
      !currency ||
      !timezone ||
      !defaultLocationName?.trim()
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedSlug = normalizeSlug(orgSlug.trim())
    if (!isValidSlug(normalizedSlug)) {
      return new Response(
        JSON.stringify({
          error:
            'L’identifiant doit contenir entre 2 et 50 caractères, uniquement des minuscules, chiffres et tirets.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const authUserId = claims.sub

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
      p_org_slug: normalizedSlug,
      p_currency: currency,
      p_timezone: timezone,
      p_default_location_name: defaultLocationName.trim(),
    })

    if (rpcError) {
      let status = 500
      if (rpcError.message?.includes('organizations_slug_unique')) {
        status = 409
        // Build a suggestion by appending an incremental numeric suffix.
        const { data: existing } = await adminClient
          .from('organizations')
          .select('slug')
          .or(`slug.eq.${normalizedSlug},slug.ilike.${normalizedSlug}-%`)

        const taken = new Set((existing ?? []).map((row) => row.slug))
        let candidate = normalizedSlug
        let suffix = 2
        while (taken.has(candidate)) {
          candidate = `${normalizedSlug}-${suffix}`
          suffix++
        }

        return new Response(
          JSON.stringify({
            error: `L’identifiant « ${normalizedSlug} » est déjà utilisé. suggestion: ${candidate}`,
            suggestion: candidate,
            code: rpcError.code,
          }),
          { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (rpcError.message?.includes('organizations_name_unique')) status = 409
      if (rpcError.message?.includes('Invalid slug')) status = 400
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
