import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface OrgFeatures {
  has_cashier_enabled: boolean
  has_storefront_enabled: boolean
  has_api_enabled: boolean
  storefront_location_id: string | null
}

async function getOrgFeatures(
  adminClient: ReturnType<typeof createClient>,
  orgId: string
): Promise<OrgFeatures | null> {
  const { data, error } = await adminClient
    .from('organizations')
    .select('has_cashier_enabled, has_storefront_enabled, has_api_enabled, storefront_location_id')
    .eq('id', orgId)
    .single()
  if (error || !data) return null
  return data as unknown as OrgFeatures
}

interface RecordMovementPayload {
  product_id: string
  location_id: string
  target_location_id?: string | null
  type: 'IN' | 'OUT' | 'INVENTORY' | 'ADJUSTMENT' | 'TRANSFER'
  quantity: number
  reason?: string | null
  contact_id?: string | null
  unit_price?: number | null
  cashier_session_id?: string | null
  client_operation_id?: string | null
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const operator = await getCurrentMembership(adminClient, claims.sub)

    if (!operator || !['super_admin', 'admin', 'operator', 'cashier'].includes(operator.role)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          debug: 'Operator not found or insufficient role',
        }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const payload: RecordMovementPayload = await req.json()
    if (
      !payload.product_id ||
      !payload.location_id ||
      !payload.type ||
      typeof payload.quantity !== 'number' ||
      payload.quantity <= 0
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const features = await getOrgFeatures(adminClient, operator.org_id)
    if (payload.cashier_session_id && !features?.has_cashier_enabled) {
      return new Response(JSON.stringify({ error: 'Caisse non activée pour cette organisation' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const limits = await getOrgLimits(adminClient, operator.org_id)
    if (!limits) {
      return new Response(JSON.stringify({ error: 'Could not load organization limits' }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (limits.isSuspended) {
      return new Response(JSON.stringify({ error: 'Organization suspended' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (isAtLimit(limits.usedMovementsThisMonth, limits.maxMonthlyMovements)) {
      return new Response(
        JSON.stringify({ error: 'Monthly movement limit reached for this plan' }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    // record_movement uses auth.uid() to resolve the operator and their org.
    // Calling it through the service-role adminClient would make auth.uid() null,
    // so we call it through a user client that carries the operator's JWT.
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data, error } = await userClient.rpc('record_movement', {
      p_org_id: operator.org_id,
      p_product_id: payload.product_id,
      p_location_id: payload.location_id,
      p_target_location_id: payload.target_location_id ?? null,
      p_type: payload.type,
      p_quantity: payload.quantity,
      p_reason: payload.reason ?? null,
      p_contact_id: payload.contact_id ?? null,
      p_unit_price: payload.unit_price ?? null,
      p_cashier_session_id: payload.cashier_session_id ?? null,
      p_client_operation_id: payload.client_operation_id ?? null,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const movementId =
      data && typeof data === 'object' && 'id' in data && typeof data.id === 'string'
        ? data.id
        : data

    return new Response(JSON.stringify({ movement_id: movementId }), {
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
