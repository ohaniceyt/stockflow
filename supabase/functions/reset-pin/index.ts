import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

interface ResetPinPayload {
  userId: string
  newPin: string
  forcePinChange?: boolean
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

    const operatorId = authUser.email.replace('@stockflow.local', '')

    const { data: operator, error: operatorError } = await client
      .from('users')
      .select('role, org_id')
      .eq('id', operatorId)
      .single()

    if (operatorError || !operator || !['super_admin', 'admin'].includes(operator.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { userId, newPin, forcePinChange = true }: ResetPinPayload = await req.json()
    if (!userId || !newPin || newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: targetUser, error: targetError } = await client
      .from('users')
      .select('id, org_id, role')
      .eq('id', userId)
      .single()

    if (targetError || !targetUser || targetUser.org_id !== operator.org_id) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (operator.role === 'admin' && targetUser.role === 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const newHash = `pbkdf2$${encodeBase64(salt)}$${await hashPin(newPin, salt)}`

    const { error: updateError } = await client
      .from('users')
      .update({
        pin_hash: newHash,
        force_pin_change: forcePinChange,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

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
