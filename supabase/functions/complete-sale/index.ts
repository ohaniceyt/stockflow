import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { logActivity } from '../_shared/audit.ts'
import { getLogger, getTraceId } from '../_shared/logger.ts'

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
  total?: number
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

interface PriceMismatch {
  product_id: string
  product_name: string
  expected: number
  received: number
}

type PriceValidationResult =
  | {
      ok: true
      validatedItems: CompleteSaleItem[]
    }
  | {
      ok: false
      reason: string
      mismatches: PriceMismatch[]
    }

const PRICE_EPSILON = 0.005

function withinPriceTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= PRICE_EPSILON
}

async function validateItemPrices(
  adminClient: ReturnType<typeof createClient>,
  orgId: string,
  items: CompleteSaleItem[]
): Promise<PriceValidationResult> {
  const productIds = items.map((item) => item.product_id).filter(Boolean)
  if (productIds.length === 0) {
    return { ok: false, reason: 'No products in cart', mismatches: [] }
  }

  const { data: products, error } = await adminClient
    .from('products')
    .select('id, name, selling_price')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('id', productIds)

  if (error) {
    return { ok: false, reason: 'Failed to load product prices', mismatches: [] }
  }

  const priceMap = new Map<string, number>()
  const nameMap = new Map<string, string>()
  for (const product of products ?? []) {
    priceMap.set(product.id, Number(product.selling_price))
    nameMap.set(product.id, product.name)
  }

  const mismatches: PriceMismatch[] = []
  const validatedItems: CompleteSaleItem[] = []

  for (const item of items) {
    const trustedPrice = priceMap.get(item.product_id)
    if (trustedPrice === undefined) {
      mismatches.push({
        product_id: item.product_id,
        product_name: item.product_name,
        expected: 0,
        received: item.unit_price,
      })
      continue
    }

    if (!withinPriceTolerance(item.unit_price, trustedPrice)) {
      mismatches.push({
        product_id: item.product_id,
        product_name: item.product_name,
        expected: trustedPrice,
        received: item.unit_price,
      })
    }

    validatedItems.push({
      ...item,
      unit_price: trustedPrice,
      product_name: nameMap.get(item.product_id) ?? item.product_name,
    })
  }

  if (mismatches.length > 0) {
    return { ok: false, reason: 'Price mismatch detected', mismatches }
  }

  return { ok: true, validatedItems }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  const traceId = getTraceId(req)
  const log = getLogger('complete-sale', traceId)

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

    const validation = await validateItemPrices(adminClient, operator.org_id, payload.items)
    if (!validation.ok) {
      log.warn('sale_price_validation_failed', {
        org_id: operator.org_id,
        actor_id: claims.sub,
        reason: validation.reason,
        mismatch_count: validation.mismatches.length,
      })

      await logActivity(adminClient, {
        org_id: operator.org_id,
        actor_id: claims.sub,
        action: 'sale_fraud_attempt',
        target_type: 'receipt',
        target_id: null,
        details: {
          reason: validation.reason,
          mismatches: validation.mismatches,
          amount_paid: payload.amount_paid,
          currency: payload.currency,
          payment_method: payload.payment_method,
        },
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })

      return new Response(
        JSON.stringify({
          error: 'Prix du panier non conforme aux tarifs enregistrés',
          details: validation.mismatches,
        }),
        {
          status: 400,
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
      p_items: validation.validatedItems,
    })

    if (saleError || !saleData || typeof saleData !== 'object' || !('receipt_id' in saleData)) {
      log.error(
        'sale_rpc_failed',
        { org_id: operator.org_id, actor_id: claims.sub },
        saleError ?? undefined
      )
      return new Response(
        JSON.stringify({ error: saleError?.message ?? 'Failed to complete sale' }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const receiptId = (saleData as { receipt_id: string }).receipt_id
    log.info('sale_completed', {
      org_id: operator.org_id,
      actor_id: claims.sub,
      receipt_id: receiptId,
      total: (saleData as { total?: number }).total ?? null,
      item_count: payload.items.length,
    })

    await logActivity(adminClient, {
      org_id: operator.org_id,
      actor_id: claims.sub,
      action: 'sale_completed',
      target_type: 'receipt',
      target_id: receiptId,
      details: {
        amount_paid: payload.amount_paid,
        currency: payload.currency,
        item_count: payload.items.length,
        payment_method: payload.payment_method,
        subtotal: (saleData as { subtotal?: number }).subtotal ?? null,
        tax_amount: (saleData as { tax_amount?: number }).tax_amount ?? null,
        total: (saleData as { total?: number }).total ?? null,
      },
    })

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
    log.error('sale_unhandled_error', {}, err instanceof Error ? err : new Error(message))
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
