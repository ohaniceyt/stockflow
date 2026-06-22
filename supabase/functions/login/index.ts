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

    const { userId, pin }: LoginPayload = await req.json()
    if (!userId || !pin || pin.length < 4 || pin.length > 8) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: user, error } = await adminClient
      .from('users')
      .select(
        'id, org_id, name, email, email_verified, role, pin_hash, is_active, force_pin_change'
      )
      .eq('id', userId)
      .single()

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('onboarding_completed')
      .eq('id', user?.org_id ?? '')
      .single()

    if (error || !user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (orgError) {
      return new Response(JSON.stringify({ error: orgError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!user.is_active) {
      return new Response(JSON.stringify({ error: 'Account disabled' }), {
        status: 403,
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
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await adminClient
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    const onboardingCompleted =
      ['super_admin', 'admin'].includes(user.role) && org?.onboarding_completed === true

    // Dev-only bypass for demo accounts when Supabase email rate limits block OTP.
    // Controlled by the DEMO_BYPASS environment variable; never enable in production.
    const demoBypass = Deno.env.get('DEMO_BYPASS') === 'true'
    const isDemoAccount =
      demoBypass &&
      (user.id === '11111111-1111-1111-1111-111111111111' ||
        user.id === '22222222-2222-2222-2222-222222222222')

    if (isDemoAccount) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      if (anonKey) {
        const anonClient = createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        const demoPassword = `demo-${user.id.slice(0, 8)}`

        // Ensure the auth user exists and has a known password
        await adminClient.auth.admin
          .createUser({
            id: user.id,
            email: user.email,
            password: demoPassword,
            email_confirm: true,
            user_metadata: { org_id: user.org_id, role: user.role, name: user.name },
          })
          .catch(() => {
            // User may already exist; update password to keep it deterministic.
            return adminClient.auth.admin.updateUserById(user.id, { password: demoPassword })
          })

        const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
          email: user.email,
          password: demoPassword,
        })

        if (!signInError && signInData.session) {
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
      }
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
