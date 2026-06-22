import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

interface LoginPayload {
  userId: string
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

    const { userId, pin }: LoginPayload = await req.json()
    if (!userId || !pin || pin.length < 4 || pin.length > 8) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate-limit by user
    const userFailures = await countRecentFailures(adminClient, 'user_id', userId)
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

    const { data: user, error } = await adminClient
      .from('users')
      .select(
        'id, org_id, name, email, email_verified, role, pin_hash, is_active, force_pin_change'
      )
      .eq('id', userId)
      .single()

    if (error || !user) {
      await recordAttempt(adminClient, { ipAddress: clientIp, userId, succeeded: false })
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!user.is_active) {
      await recordAttempt(adminClient, { ipAddress: clientIp, userId, succeeded: false })
      return new Response(JSON.stringify({ error: 'Account disabled' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('onboarding_completed')
      .eq('id', user.org_id ?? '')
      .single()

    if (orgError) {
      return new Response(JSON.stringify({ error: orgError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [algo, saltB64, expectedHashB64] = user.pin_hash.split('$')
    if (algo !== 'pbkdf2' || !saltB64 || !expectedHashB64) {
      return new Response(JSON.stringify({ error: 'Invalid pin format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const computedHash = await hashPin(pin, saltB64)

    if (!timingSafeEqual(computedHash, expectedHashB64)) {
      await recordAttempt(adminClient, { ipAddress: clientIp, userId, succeeded: false })
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await adminClient
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    await recordAttempt(adminClient, { ipAddress: clientIp, userId, succeeded: true })

    const onboardingCompleted =
      ['super_admin', 'admin'].includes(user.role) && org?.onboarding_completed === true

    // Dev-only bypass for demo accounts when Supabase email rate limits block OTP.
    // Controlled by the DEMO_BYPASS environment variable; never enable in production.
    const demoBypass = Deno.env.get('DEMO_BYPASS') === 'true'
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const isDemoAccount =
      demoBypass &&
      anonKey &&
      (user.id === '584a7634-fbed-41ad-a947-b104d013ee96' ||
        user.id === '0c14cf03-5341-4b95-bb9e-eb0fbcd16836')

    if (isDemoAccount) {
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const demoPassword = `demo-${user.id.slice(0, 8)}`

      const { error: createError } = await adminClient.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: demoPassword,
        email_confirm: true,
        user_metadata: { org_id: user.org_id, role: user.role, name: user.name },
      })

      if (createError) {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
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
        email: user.email,
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
          email: user.email,
          forcePinChange: user.force_pin_change,
          onboardingCompleted,
          session: {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
            expires_in: signInData.session.expires_in,
            expires_at: signInData.session.expires_at,
          },
          user: {
            id: user.id,
            orgId: user.org_id,
            name: user.name,
            email: user.email,
            emailVerified: true,
            role: user.role,
            forcePinChange: user.force_pin_change,
            onboardingCompleted,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        email: user.email,
        forcePinChange: user.force_pin_change,
        onboardingCompleted,
        user: {
          id: user.id,
          orgId: user.org_id,
          name: user.name,
          email: user.email,
          emailVerified: user.email_verified,
          role: user.role,
          forcePinChange: user.force_pin_change,
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
