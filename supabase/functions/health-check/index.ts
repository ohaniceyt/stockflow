import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runHealthCheck } from '../_shared/health.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const MONITOR_SECRET = Deno.env.get('HEALTH_CHECK_SECRET') ?? ''

function isAuthorized(req: Request): boolean {
  // Public health endpoint: allow external uptime monitors without a secret.
  // If HEALTH_CHECK_SECRET is configured, require it for the full JSON detail.
  if (!MONITOR_SECRET) return true
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${MONITOR_SECRET}`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const result = await runHealthCheck(supabase)
  const code = result.status === 'unhealthy' ? 503 : 200

  // When a secret is configured and not provided, return only the status field.
  // This prevents leaking internal check details to unauthenticated callers.
  const body = isAuthorized(req) ? result : { status: result.status, timestamp: result.timestamp }

  return new Response(JSON.stringify(body), {
    status: code,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
})
