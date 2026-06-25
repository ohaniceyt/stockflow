import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { decodeBase64, encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'

interface ChangePinPayload {
  currentPin?: string
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

function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claims = await verifyToken(supabaseUrl, anonKey, token)
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { currentPin, newPin }: ChangePinPayload = await req.json()

    if (!isValidPin(newPin)) {
      return new Response(JSON.stringify({ error: 'PIN must be 4 to 8 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const membership = await getCurrentMembership(adminClient, claims.sub)

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Membership not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!membership.is_active) {
      return new Response(JSON.stringify({ error: 'Account disabled' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If a PIN already exists and is not forced to change, require the current PIN.
    const requiresCurrentPin = !!membership.pin_hash && !membership.force_pin_change

    if (requiresCurrentPin) {
      if (!currentPin || !isValidPin(currentPin)) {
        return new Response(JSON.stringify({ error: 'Current PIN is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const [algo, saltB64, expectedHashB64] = membership.pin_hash.split('$')
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
    }

    const newSalt = crypto.getRandomValues(new Uint8Array(16))
    const newHash = `pbkdf2$${encodeBase64(newSalt)}$${await hashPin(newPin, newSalt)}`

    const { error: updateError } = await adminClient
      .from('organization_memberships')
      .update({
        pin_hash: newHash,
        force_pin_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id)

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
