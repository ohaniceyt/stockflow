import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { logActivity } from '../_shared/audit.ts'
import { getLogger, getTraceId } from '../_shared/logger.ts'
import {
  parseJsonBody,
  isUuid,
  isNonEmptyString,
  isNumber,
  isPositiveInteger,
} from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

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

interface RawCompleteSaleItem {
  product_id?: unknown
  product_name?: unknown
  quantity?: unknown
  unit_price?: unknown
  discount_amount?: unknown
  tax_amount?: unknown
  total?: unknown
}

interface RawCompleteSalePayload {
  location_id?: unknown
  cashier_session_id?: unknown
  contact_id?: unknown
  payment_method?: unknown
  currency?: unknown
  prefix?: unknown
  amount_paid?: unknown
  notes?: unknown
  items?: unknown
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

    const parsed = await parseJsonBody<RawCompleteSalePayload>(req)
    if (!parsed.ok) {
      return parsed.response
    }

    const body = parsed.body
    if (
      !isUuid(body.location_id) ||
      !isUuid(body.cashier_session_id) ||
      !isNonEmptyString(body.payment_method, 50) ||
      !isNonEmptyString(body.currency, 3) ||
      !isNumber(body.amount_paid)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const amountPaid = body.amount_paid as number
    if (amountPaid < 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount_paid' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    let contactId: string | null = null
    if (body.contact_id !== undefined && body.contact_id !== null) {
      if (!isUuid(body.contact_id)) {
        return new Response(JSON.stringify({ error: 'Invalid contact_id' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      contactId = body.contact_id as string
    }

    let prefix: string | null = null
    if (body.prefix !== undefined && body.prefix !== null) {
      if (!isNonEmptyString(body.prefix, 20)) {
        return new Response(JSON.stringify({ error: 'Invalid prefix' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      prefix = (body.prefix as string).trim()
    }

    let notes: string | null = null
    if (body.notes !== undefined && body.notes !== null) {
      if (!isNonEmptyString(body.notes, 500)) {
        return new Response(JSON.stringify({ error: 'Invalid notes' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      notes = (body.notes as string).trim()
    }

    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 200) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const typedItems: CompleteSaleItem[] = []
    for (const rawItem of body.items) {
      if (!rawItem || typeof rawItem !== 'object') {
        return new Response(JSON.stringify({ error: 'Invalid item' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      const item = rawItem as RawCompleteSaleItem
      if (
        !isUuid(item.product_id) ||
        !isNonEmptyString(item.product_name, 100) ||
        !isPositiveInteger(item.quantity) ||
        !isNumber(item.unit_price)
      ) {
        return new Response(JSON.stringify({ error: 'Invalid item' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }

      const discount =
        item.discount_amount !== undefined && item.discount_amount !== null
          ? isNumber(item.discount_amount)
            ? (item.discount_amount as number)
            : NaN
          : undefined
      const tax =
        item.tax_amount !== undefined && item.tax_amount !== null
          ? isNumber(item.tax_amount)
            ? (item.tax_amount as number)
            : NaN
          : undefined
      const total =
        item.total !== undefined && item.total !== null
          ? isNumber(item.total)
            ? (item.total as number)
            : NaN
          : undefined
      if (
        (discount !== undefined && Number.isNaN(discount)) ||
        (tax !== undefined && Number.isNaN(tax)) ||
        (total !== undefined && Number.isNaN(total))
      ) {
        return new Response(JSON.stringify({ error: 'Invalid item' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }

      typedItems.push({
        product_id: item.product_id as string,
        product_name: (item.product_name as string).trim(),
        quantity: item.quantity as number,
        unit_price: item.unit_price as number,
        ...(discount !== undefined ? { discount_amount: discount } : {}),
        ...(tax !== undefined ? { tax_amount: tax } : {}),
        ...(total !== undefined ? { total } : {}),
      })
    }

    const features = await getOrgFeatures(adminClient, operator.org_id)
    if (!features?.has_cashier_enabled) {
      return new Response(JSON.stringify({ error: 'Caisse non activée pour cette entreprise' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const limits = await getOrgLimits(adminClient, operator.org_id)
    if (!limits) {
      console.error('complete-sale: could not load organization limits', {
        org_id: operator.org_id,
      })
      return genericInternalErrorResponse(req)
    }
    if (limits.isSuspended) {
      return new Response(JSON.stringify({ error: 'Organization suspended' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (isAtLimit(limits.usedMovementsThisMonth + typedItems.length, limits.maxMonthlyMovements)) {
      return new Response(
        JSON.stringify({ error: 'Monthly movement limit reached for this plan' }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const validation = await validateItemPrices(adminClient, operator.org_id, typedItems)
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
          amount_paid: amountPaid,
          currency: body.currency as string,
          payment_method: body.payment_method as string,
          ip_address: req.headers.get('x-forwarded-for') ?? null,
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
      p_location_id: body.location_id as string,
      p_cashier_session_id: body.cashier_session_id as string,
      p_amount_paid: amountPaid,
      p_contact_id: contactId,
      p_payment_method: (body.payment_method as string).trim(),
      p_currency: (body.currency as string).trim(),
      p_prefix: prefix,
      p_notes: notes,
      p_items: validation.validatedItems,
    })

    if (saleError || !saleData || typeof saleData !== 'object' || !('receipt_id' in saleData)) {
      log.error(
        'sale_rpc_failed',
        { org_id: operator.org_id, actor_id: claims.sub },
        saleError ?? undefined
      )
      return genericInternalErrorResponse(req)
    }

    const receiptId = (saleData as { receipt_id: string }).receipt_id
    log.info('sale_completed', {
      org_id: operator.org_id,
      actor_id: claims.sub,
      receipt_id: receiptId,
      total: (saleData as { total?: number }).total ?? null,
      item_count: typedItems.length,
    })

    await logActivity(adminClient, {
      org_id: operator.org_id,
      actor_id: claims.sub,
      action: 'sale_completed',
      target_type: 'receipt',
      target_id: receiptId,
      details: {
        amount_paid: amountPaid,
        currency: body.currency as string,
        item_count: typedItems.length,
        payment_method: body.payment_method as string,
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
      console.error('complete-sale: receipt not found after sale', receiptError)
      return genericInternalErrorResponse(req)
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
  } catch (_err) {
    log.error('sale_unhandled_error', {}, _err instanceof Error ? _err : new Error(String(_err)))
    return genericInternalErrorResponse(req)
  }
})
