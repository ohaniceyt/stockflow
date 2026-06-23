import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

interface LookupPayload {
  email: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_WINDOW_MINUTES = 15
const MAX_REQUESTS_PER_IP = 30

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

async function countRecentRequests(
  client: ReturnType<typeof createClient>,
  ipAddress: string | null
): Promise<number> {
  if (!ipAddress) return 0
  const { count, error } = await client
    .from('magic_link_requests')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ipAddress)
    .gte('created_at', rateLimitCutoff())

  if (error) {
    console.error('Failed to count lookup requests:', error)
    return 0
  }
  return count ?? 0
}

async function recordRequest(
  client: ReturnType<typeof createClient>,
  email: string,
  ipAddress: string | null
): Promise<void> {
  const { error } = await client.from('magic_link_requests').insert({
    email,
    ip_address: ipAddress,
  })
  if (error) {
    console.error('Failed to record lookup request:', error)
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
    const ipRequests = await countRecentRequests(adminClient, clientIp)
    if (ipRequests >= MAX_REQUESTS_PER_IP) {
      return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email }: LookupPayload = await req.json()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const { data: user, error } = await adminClient
      .from('users')
      .select('id, name, role, org_id')
      .ilike('email', normalizedEmail)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await recordRequest(adminClient, normalizedEmail, clientIp)

    if (!user) {
      // Generic response to avoid user enumeration
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if org is suspended
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('is_suspended')
      .eq('id', user.org_id)
      .single()

    if (orgError || org?.is_suspended) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        found: true,
        userId: user.id,
        name: user.name,
        role: user.role,
        orgId: user.org_id,
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
