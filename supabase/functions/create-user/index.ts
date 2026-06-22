import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

interface CreateUserPayload {
  name: string
  email: string
  role: 'admin' | 'operator' | 'reader'
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
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
  return encodeBase64(new Uint8Array(derived))
}

function generateTempPin(): string {
  const digits = '0123456789'
  let pin = ''
  for (let i = 0; i < 4; i++) {
    pin += digits[Math.floor(Math.random() * digits.length)]
  }
  return pin
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

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        global: {
          headers: {
            Authorization: authHeader,
            apikey: serviceRoleKey,
          },
        },
      },
    })

    const {
      data: { user: authUser },
      error: userError,
    } = await client.auth.getUser()
    if (userError || !authUser?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: operator, error: operatorError } = await client
      .from('users')
      .select('role, org_id')
      .eq('id', authUser.id)
      .single()

    if (operatorError || !operator || !['super_admin', 'admin'].includes(operator.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { name, email, role }: CreateUserPayload = await req.json()
    if (!name || !email || !role || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (operator.role === 'admin' && role === 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tempPin = generateTempPin()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const pinHash = `pbkdf2$${encodeBase64(salt)}$${await hashPin(tempPin, salt)}`

    const { data: createAuthData, error: createAuthError } = await client.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: false,
      user_metadata: { org_id: operator.org_id, role, name },
    })

    if (createAuthError || !createAuthData.user) {
      return new Response(
        JSON.stringify({ error: createAuthError?.message ?? 'Could not create auth user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: insertError } = await client.from('users').insert({
      id: createAuthData.user.id,
      org_id: operator.org_id,
      name,
      email,
      email_verified: false,
      role,
      pin_hash: pinHash,
      is_active: true,
      force_pin_change: true,
    })

    if (insertError) {
      // Best-effort cleanup of auth user
      await client.auth.admin.deleteUser(createAuthData.user.id)
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        tempPin,
        message: 'Utilisateur créé. Communiquez le PIN temporaire.',
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
