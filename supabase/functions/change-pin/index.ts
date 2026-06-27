import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface ChangePinPayload {
  currentPin?: string
  newPin: string
}

function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin)
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

    const { newPin }: ChangePinPayload = await req.json()

    if (!isValidPin(newPin)) {
      return new Response(JSON.stringify({ error: 'PIN must be 4 to 8 digits' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // The AppLock PIN is stored locally on the device. This endpoint only validates
    // that the user is authenticated and the new PIN format is acceptable.
    // The actual PIN hash is persisted in IndexedDB by the frontend.
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
