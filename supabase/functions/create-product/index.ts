import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'

interface CreateProductPayload {
  org_id: string
  name: string
  category?: string | null
  unit: string
  threshold?: number
  cost_price?: number
  selling_price?: number
  supplier?: string | null
  description?: string | null
  barcode?: string | null
  is_active?: boolean
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

    if (operatorError || !operator || !['super_admin', 'admin', 'operator'].includes(operator.role)) {
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

    const payload: CreateProductPayload = await req.json()
    if (!payload.org_id || !payload.name || !payload.unit) {
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
    if (isAtLimit(limits.usedProducts, limits.maxProducts)) {
      return new Response(JSON.stringify({ error: 'Product limit reached for this plan' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await adminClient
      .from('products')
      .insert({
        org_id: payload.org_id,
        name: payload.name,
        category: payload.category ?? null,
        unit: payload.unit,
        threshold: payload.threshold ?? 0,
        cost_price: payload.cost_price ?? 0,
        selling_price: payload.selling_price ?? 0,
        supplier: payload.supplier ?? null,
        description: payload.description ?? null,
        barcode: payload.barcode ?? null,
        is_active: payload.is_active ?? true,
      })
      .select()
      .single()

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: error?.message ?? 'Could not create product' }),
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
