import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody, isNonEmptyString, isEnum } from '../_shared/validate.ts'
import { internalErrorResponse, genericInternalErrorResponse } from '../_shared/errors.ts'

interface Payload {
  orgName: unknown
  orgSlug: unknown
  country: unknown
  currency: unknown
  timezone: unknown
  defaultLocationName: unknown
  plan?: unknown
}

const ALLOWED_PLANS = ['free', 'starter', 'pro'] as const

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

    const body = parsed.body
    if (
      !isNonEmptyString(body.orgName, 100) ||
      !isNonEmptyString(body.orgSlug, 50) ||
      !isNonEmptyString(body.country, 2) ||
      !isNonEmptyString(body.currency, 3) ||
      !isNonEmptyString(body.timezone, 64) ||
      !isNonEmptyString(body.defaultLocationName, 100)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const selectedPlan = isEnum(body.plan, ALLOWED_PLANS) ? body.plan : 'free'

    const normalizedSlug = normalizeSlug((body.orgSlug as string).trim())
    if (!isValidSlug(normalizedSlug)) {
      return new Response(
        JSON.stringify({
          error:
            'L’identifiant doit contenir entre 2 et 50 caractères, uniquement des minuscules, chiffres et tirets.',
        }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // User client carries the verified JWT so complete_onboarding can assert auth.uid().
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const authUserId = claims.sub

    // Reject onboarding if the user's email is not verified.
    const { data: authUser, error: authUserError } =
      await adminClient.auth.admin.getUserById(authUserId)
    if (authUserError || !authUser.user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (!authUser.user.email_confirmed_at) {
      return new Response(JSON.stringify({ error: 'Email not verified' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
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
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Atomic onboarding via RPC: creates org, super_admin membership, selected subscription and default location.
    // We call it through the user client so the RPC can assert auth.uid() == p_user_id.
    const { data: rpcData, error: rpcError } = await userClient.rpc('complete_onboarding', {
      p_user_id: authUserId,
      p_org_name: (body.orgName as string).trim(),
      p_org_slug: normalizedSlug,
      p_country: (body.country as string).trim(),
      p_currency: (body.currency as string).trim(),
      p_timezone: (body.timezone as string).trim(),
      p_default_location_name: (body.defaultLocationName as string).trim(),
      p_plan_id: selectedPlan,
    })

    if (rpcError) {
      if (rpcError.message?.includes('organizations_slug_unique')) {
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
          }),
          { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      if (rpcError.message?.includes('organizations_name_unique')) {
        return new Response(
          JSON.stringify({ error: 'An organization with this name already exists' }),
          { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      if (rpcError.message?.includes('Invalid slug')) {
        return internalErrorResponse(req, 400, 'Invalid organization identifier')
      }

      console.error('complete-onboarding RPC failed:', rpcError)
      return genericInternalErrorResponse(req)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Onboarding terminé', orgId: rpcData }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
