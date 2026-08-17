import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { getClientIp, isRateLimited, recordRateLimitRequest } from '../_shared/rateLimit.ts'
import {
  parseJsonBody,
  isSlug,
  isNonEmptyString,
  isEmail,
  isPhone,
  isString,
  isUuid,
  isPositiveInteger,
  isNumber,
} from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface OrderItem {
  product_id: string
  quantity: number
  unit_price: number
}

interface CreateStorefrontOrderPayload {
  org_slug: string
  customer_name: string
  customer_email: string
  customer_phone?: string | null
  address?: string | null
  items: OrderItem[]
}

function generateOrderNumber(): string {
  const now = new Date()
  const prefix = 'CMD'
  const timestamp = now.getTime().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return genericInternalErrorResponse(req)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const clientIp = getClientIp(req)
    const ipKey = clientIp ? { key: clientIp, type: 'ip' as const } : null
    if (
      ipKey &&
      (await isRateLimited(adminClient, ipKey, { maxRequests: 10, windowMinutes: 15 }))
    ) {
      return new Response(
        JSON.stringify({ error: 'Too many orders from this network. Try again later.' }),
        { status: 429, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const parsed = await parseJsonBody<CreateStorefrontOrderPayload>(req)
    if (!parsed.ok) {
      return parsed.response
    }
    const payload = parsed.body

    if (!isSlug(payload.org_slug)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!isNonEmptyString(payload.customer_name, 100)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!isEmail(payload.customer_email)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (
      payload.customer_phone !== undefined &&
      payload.customer_phone !== null &&
      !isPhone(payload.customer_phone)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (
      payload.address !== undefined &&
      payload.address !== null &&
      !isString(payload.address, 255)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    for (const item of payload.items) {
      if (
        !isUuid(item.product_id) ||
        !isPositiveInteger(item.quantity) ||
        !isNumber(item.unit_price) ||
        !Number.isFinite(item.unit_price) ||
        item.unit_price < 0
      ) {
        return new Response(JSON.stringify({ error: 'Invalid item' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('id, has_storefront_enabled, storefront_location_id, currency')
      .eq('slug', payload.org_slug)
      .single()

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: 'Boutique introuvable' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!org.has_storefront_enabled || !org.storefront_location_id) {
      return new Response(JSON.stringify({ error: 'Store front non activé' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const orgId = org.id
    const locationId = org.storefront_location_id

    const productIds = payload.items.map((i) => i.product_id)
    const { data: products, error: productsError } = await adminClient
      .from('products')
      .select('id, org_id, name, selling_price, is_active')
      .in('id', productIds)
      .eq('org_id', orgId)
      .eq('is_active', true)

    if (productsError) {
      return genericInternalErrorResponse(req)
    }

    const productMap = new Map(products?.map((p) => [p.id, p]))
    const missingProducts = payload.items.filter((i) => !productMap.has(i.product_id))
    if (missingProducts.length > 0) {
      return new Response(JSON.stringify({ error: 'Produit non disponible' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: stock, error: stockError } = await adminClient
      .from('stock_levels')
      .select('product_id, quantity')
      .eq('location_id', locationId)
      .in('product_id', productIds)

    if (stockError) {
      return genericInternalErrorResponse(req)
    }

    const stockMap = new Map(stock?.map((s) => [s.product_id, s.quantity]))
    const insufficient = payload.items.find((i) => (stockMap.get(i.product_id) ?? 0) < i.quantity)
    if (insufficient) {
      return new Response(JSON.stringify({ error: 'Stock insuffisant' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: existingContact } = await adminClient
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', payload.customer_email.trim().toLowerCase())
      .eq('type', 'CUSTOMER')
      .maybeSingle()

    let contactId = existingContact?.id ?? null
    if (!contactId) {
      const { data: newContact, error: contactError } = await adminClient
        .from('contacts')
        .insert({
          org_id: orgId,
          type: 'CUSTOMER',
          name: payload.customer_name.trim(),
          email: payload.customer_email.trim().toLowerCase(),
          phone: payload.customer_phone?.trim() || null,
          address: payload.address?.trim() || null,
          is_active: true,
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        return genericInternalErrorResponse(req)
      }
      contactId = newContact.id
    }

    const orderNumber = generateOrderNumber()

    const { data: orderResult, error: orderError } = await adminClient.rpc(
      'record_storefront_order',
      {
        p_org_id: orgId,
        p_location_id: locationId,
        p_contact_id: contactId,
        p_items: payload.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price || productMap.get(i.product_id)?.selling_price,
        })),
        p_reason: `Commande ${orderNumber}`,
      }
    )

    if (orderError || !orderResult) {
      return genericInternalErrorResponse(req)
    }

    const movementIds = (orderResult as { movement_ids: string[] }).movement_ids

    if (ipKey) {
      await recordRateLimitRequest(adminClient, ipKey)
    }

    return new Response(
      JSON.stringify({
        order_id: movementIds[0] ?? null,
        order_number: orderNumber,
        movement_count: movementIds.length,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    )
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
