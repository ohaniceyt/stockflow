import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface OrgFeatures {
  has_cashier_enabled: boolean
}

async function getOrgFeatures(
  adminClient: ReturnType<typeof createClient>,
  orgId: string
): Promise<OrgFeatures | null> {
  const { data, error } = await adminClient
    .from('organizations')
    .select('has_cashier_enabled')
    .eq('id', orgId)
    .single()
  if (error || !data) return null
  return data as unknown as OrgFeatures
}

interface CompleteSaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_amount?: number
  tax_amount?: number
  total: number
}

interface CompleteSalePayload {
  location_id: string
  cashier_session_id: string
  contact_id?: string | null
  payment_method: string
  currency: string
  prefix?: string | null
  amount_paid: number
  notes?: string | null
  items: CompleteSaleItem[]
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

    if (
      !operator ||
      !['super_admin', 'admin', 'operator', 'cashier'].includes(operator.role as string)
    ) {
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

    const payload: CompleteSalePayload = await req.json()
    if (
      !payload.location_id ||
      !payload.cashier_session_id ||
      !payload.payment_method ||
      typeof payload.amount_paid !== 'number' ||
      !Array.isArray(payload.items) ||
      payload.items.length === 0
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const features = await getOrgFeatures(adminClient, operator.org_id)
    if (!features?.has_cashier_enabled) {
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
    if (
      isAtLimit(limits.usedMovementsThisMonth + payload.items.length, limits.maxMonthlyMovements)
    ) {
      return new Response(
        JSON.stringify({ error: 'Monthly movement limit reached for this plan' }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: saleData, error: saleError } = await userClient.rpc('complete_sale', {
      p_org_id: operator.org_id,
      p_location_id: payload.location_id,
      p_cashier_session_id: payload.cashier_session_id,
      p_amount_paid: payload.amount_paid,
      p_contact_id: payload.contact_id ?? null,
      p_payment_method: payload.payment_method,
      p_currency: payload.currency,
      p_prefix: payload.prefix ?? null,
      p_notes: payload.notes ?? null,
      p_items: payload.items,
    })

    if (saleError || !saleData || typeof saleData !== 'object' || !('receipt_id' in saleData)) {
      return new Response(
        JSON.stringify({ error: saleError?.message ?? 'Failed to complete sale' }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const receiptId = (saleData as { receipt_id: string }).receipt_id

    const [{ data: receipt, error: receiptError }, { data: items }] = await Promise.all([
      adminClient.from('receipts').select('*').eq('id', receiptId).single(),
      adminClient.from('receipt_items').select('*').eq('receipt_id', receiptId),
    ])

    if (receiptError || !receipt) {
      return new Response(JSON.stringify({ error: receiptError?.message ?? 'Receipt not found' }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        receipt,
        items: items ?? [],
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
