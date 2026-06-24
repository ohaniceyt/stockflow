import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

interface LoginPayload {
  membershipId: string
  pin: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_WINDOW_MINUTES = 15
const MAX_FAILED_ATTEMPTS_PER_USER = 5
const MAX_FAILED_ATTEMPTS_PER_IP = 20

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

async function hashPin(pin: string, saltB64: string): Promise<string> {
  const salt = decodeBase64(saltB64)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const bytes = new Uint8Array(derived)
  return btoa(String.fromCharCode(...bytes))
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') ?? req.headers.get('cf-connecting-ip') ?? null
}

function rateLimitCutoff(): string {
  return new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
}

async function countRecentFailures(
  client: ReturnType<typeof createClient>,
  field: 'user_id' | 'ip_address',
  value: string | null
): Promise<number> {
  if (!value) return 0
  const { count, error } = await client
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('succeeded', false)
    .eq(field, value)
    .gte('created_at', rateLimitCutoff())

  if (error) {
    console.error('Failed to count login attempts:', error)
    return 0
  }
  return count ?? 0
}

async function recordAttempt(
  client: ReturnType<typeof createClient>,
  {
    ipAddress,
    userId,
    succeeded,
  }: { ipAddress: string | null; userId: string | null; succeeded: boolean }
): Promise<void> {
  const insert: Record<string, unknown> = {
    ip_address: ipAddress,
    succeeded,
  }
  if (userId) {
    insert.user_id = userId
  }
  const { error } = await client.from('login_attempts').insert(insert)
  if (error) {
    console.error('Failed to record login attempt:', error)
  }
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

    const clientIp = getClientIp(req)

    const { membershipId, pin }: LoginPayload = await req.json()
    if (!membershipId || !pin || pin.length < 4 || pin.length > 8) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('organization_memberships')
      .select(
        'id, org_id, user_id, role, pin_hash, is_active, force_pin_change, users!inner(id, name, email, email_verified)'
      )
      .eq('id', membershipId)
      .eq('is_active', true)
      .single()

    if (membershipError || !membership) {
      await recordAttempt(adminClient, { ipAddress: clientIp, userId: null, succeeded: false })
      return new Response(JSON.stringify({ error: 'Invalid membership' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authUserId = membership.user_id as string
    const profile = membership.users as unknown as {
      id: string
      name: string
      email: string
      email_verified: boolean
    }

    // Rate-limit by user
    const userFailures = await countRecentFailures(adminClient, 'user_id', authUserId)
    if (userFailures >= MAX_FAILED_ATTEMPTS_PER_USER) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate-limit by IP
    const ipFailures = await countRecentFailures(adminClient, 'ip_address', clientIp)
    if (ipFailures >= MAX_FAILED_ATTEMPTS_PER_IP) {
      return new Response(
        JSON.stringify({ error: 'Too many attempts from this network. Try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('name, onboarding_completed, is_suspended, suspension_reason')
      .eq('id', membership.org_id)
      .single()

    const { data: platformAdminData } = await adminClient.rpc('is_platform_admin', {
      p_user_id: authUserId,
    })
    const isPlatformAdmin = platformAdminData === true

    if (orgError) {
      return new Response(JSON.stringify({ error: orgError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (org?.is_suspended) {
      await recordAttempt(adminClient, {
        ipAddress: clientIp,
        userId: authUserId,
        succeeded: false,
      })
      return new Response(
        JSON.stringify({
          error: 'Organization suspended',
          message: org.suspension_reason ?? 'This organization has been suspended.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [algo, saltB64, expectedHashB64] = (membership.pin_hash as string).split('$')
    if (algo !== 'pbkdf2' || !saltB64 || !expectedHashB64) {
      return new Response(JSON.stringify({ error: 'Invalid pin format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const computedHash = await hashPin(pin, saltB64)

    if (!timingSafeEqual(computedHash, expectedHashB64)) {
      await recordAttempt(adminClient, {
        ipAddress: clientIp,
        userId: authUserId,
        succeeded: false,
      })
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Activate this org/membership for the session
    await adminClient
      .from('users')
      .update({ active_org_id: membership.org_id })
      .eq('id', authUserId)
    await adminClient
      .from('organization_memberships')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', membershipId)

    await recordAttempt(adminClient, { ipAddress: clientIp, userId: authUserId, succeeded: true })

    const onboardingCompleted =
      ['super_admin', 'admin'].includes(membership.role as string) &&
      org?.onboarding_completed === true

    // Dev-only bypass for demo accounts when Supabase email rate limits block OTP.
    // Controlled by the DEMO_BYPASS environment variable; never enable in production.
    const demoBypass = Deno.env.get('DEMO_BYPASS') === 'true'
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const isDemoAccount =
      demoBypass &&
      anonKey &&
      (authUserId === '584a7634-fbed-41ad-a947-b104d013ee96' ||
        authUserId === '0c14cf03-5341-4b95-bb9e-eb0fbcd16836')

    if (isDemoAccount) {
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const demoPassword = `demo-${authUserId.slice(0, 8)}`

      const { error: createError } = await adminClient.auth.admin.createUser({
        id: authUserId,
        email: profile.email,
        password: demoPassword,
        email_confirm: true,
        user_metadata: {
          org_id: membership.org_id,
          role: membership.role,
          name: profile.name,
          membership_id: membership.id,
        },
      })

      if (createError) {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, {
          password: demoPassword,
        })
        if (updateError) {
          return new Response(
            JSON.stringify({ error: `Bypass auth setup failed: ${updateError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
        email: profile.email,
        password: demoPassword,
      })

      if (signInError || !signInData.session) {
        return new Response(
          JSON.stringify({
            error: `Bypass sign-in failed: ${signInError?.message ?? 'no session'}`,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          email: profile.email,
          forcePinChange: membership.force_pin_change,
          onboardingCompleted,
          session: {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
            expires_in: signInData.session.expires_in,
            expires_at: signInData.session.expires_at,
          },
          user: {
            id: authUserId,
            membershipId: membership.id,
            orgId: membership.org_id,
            orgName: org?.name ?? '',
            name: profile.name,
            email: profile.email,
            emailVerified: profile.email_verified,
            role: membership.role,
            isPlatformAdmin,
            forcePinChange: membership.force_pin_change,
            onboardingCompleted,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        email: profile.email,
        forcePinChange: membership.force_pin_change,
        onboardingCompleted,
        user: {
          id: authUserId,
          membershipId: membership.id,
          orgId: membership.org_id,
          orgName: org?.name ?? '',
          name: profile.name,
          email: profile.email,
          emailVerified: profile.email_verified,
          role: membership.role,
          isPlatformAdmin,
          forcePinChange: membership.force_pin_change,
          onboardingCompleted,
        },
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
