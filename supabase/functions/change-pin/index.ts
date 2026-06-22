import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { decodeBase64, encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

interface ChangePinPayload {
  currentPin: string
  newPin: string
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
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
    const apiKey = req.headers.get('apikey') ?? serviceRoleKey

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
            apikey: apiKey,
          },
        },
      },
    })

    const {
      data: { user: authUser },
      error: userError,
    } = await client.auth.getUser()
    if (userError || !authUser?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { currentPin, newPin }: ChangePinPayload = await req.json()
    if (!newPin || newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      return new Response(JSON.stringify({ error: 'Invalid new PIN' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!currentPin || currentPin.length < 4 || currentPin.length > 8 || !/^\d+$/.test(currentPin)) {
      return new Response(JSON.stringify({ error: 'Invalid current PIN' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: user, error: fetchError } = await client
      .from('users')
      .select('id, pin_hash, is_active')
      .eq('id', authUser.id)
      .single()

    if (fetchError || !user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
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
      return new Response(JSON.stringify({ error: 'Invalid PIN format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const salt = decodeBase64(saltB64)
    const currentHash = await hashPin(currentPin, salt)

    if (!timingSafeEqual(currentHash, expectedHashB64)) {
      return new Response(JSON.stringify({ error: 'Current PIN is incorrect' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newSalt = crypto.getRandomValues(new Uint8Array(16))
    const newHash = `pbkdf2$${encodeBase64(newSalt)}$${await hashPin(newPin, newSalt)}`

    const { error: updateError } = await client
      .from('users')
      .update({
        pin_hash: newHash,
        force_pin_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authUser.id)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
