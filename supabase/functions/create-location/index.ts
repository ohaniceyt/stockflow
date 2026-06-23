import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'

interface CreateLocationPayload {
  org_id: string
  name: string
  description?: string | null
  address?: string | null
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claims = parseJwt(token)
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: operator, error: operatorError } = await adminClient
      .from('users')
      .select('role, org_id')
      .eq('id', claims.sub)
      .single()

    if (operatorError || !operator || !['super_admin', 'admin'].includes(operator.role)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          debug: operatorError?.message ?? 'Operator not found or insufficient role',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const payload: CreateLocationPayload = await req.json()
    if (!payload.org_id || !payload.name) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (operator.org_id !== payload.org_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const limits = await getOrgLimits(adminClient, payload.org_id)
    if (!limits) {
      return new Response(JSON.stringify({ error: 'Could not load organization limits' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (limits.isSuspended) {
      return new Response(JSON.stringify({ error: 'Organization suspended' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (isAtLimit(limits.usedLocations, limits.maxLocations)) {
      return new Response(JSON.stringify({ error: 'Location limit reached for this plan' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await adminClient
      .from('locations')
      .insert({
        org_id: payload.org_id,
        name: payload.name,
        description: payload.description ?? null,
        address: payload.address ?? null,
        is_default: false,
      })
      .select()
      .single()

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: error?.message ?? 'Could not create location' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify(data), {
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
