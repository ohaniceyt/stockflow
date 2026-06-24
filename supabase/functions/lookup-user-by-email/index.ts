import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

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

    const { data: memberships, error } = await adminClient
      .from('organization_memberships')
      .select(
        'id, role, org_id, user_id, users!inner(id, name, email), organizations!inner(name, is_suspended)'
      )
      .ilike('users.email', normalizedEmail)
      .eq('is_active', true)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await recordRequest(adminClient, normalizedEmail, clientIp)

    if (!memberships || memberships.length === 0) {
      // Generic response to avoid user enumeration
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const available = (
      memberships as unknown as Array<{
        id: string
        role: string
        org_id: string
        user_id: string
        users: { id: string; name: string; email: string }
        organizations: { name: string; is_suspended: boolean }
      }>
    )
      .filter((m) => !m.organizations.is_suspended)
      .map((m) => ({
        membershipId: m.id,
        userId: m.user_id,
        name: m.users.name,
        role: m.role,
        orgId: m.org_id,
        orgName: m.organizations.name,
      }))

    if (available.length === 0) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ found: true, options: available }), {
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
