import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runHealthCheck } from '../_shared/health.ts'

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const result = await runHealthCheck(supabase)
  const code = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503

  return new Response(JSON.stringify(result), {
    status: code,
    headers: { 'Content-Type': 'application/json' },
  })
})
