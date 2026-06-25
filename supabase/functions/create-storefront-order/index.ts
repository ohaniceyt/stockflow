import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const payload: CreateStorefrontOrderPayload = await req.json()
    if (
      !payload.org_slug ||
      !payload.customer_name?.trim() ||
      !payload.customer_email?.trim() ||
      !Array.isArray(payload.items) ||
      payload.items.length === 0
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('id, has_storefront_enabled, storefront_location_id, currency')
      .eq('slug', payload.org_slug)
      .single()

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: 'Boutique introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!org.has_storefront_enabled || !org.storefront_location_id) {
      return new Response(JSON.stringify({ error: 'Store front non activé' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const orgId = org.id
    const locationId = org.storefront_location_id

    // Validate items
    for (const item of payload.items) {
      if (!item.product_id || typeof item.quantity !== 'number' || item.quantity <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid item' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Check product ownership and stock
    const productIds = payload.items.map((i) => i.product_id)
    const { data: products, error: productsError } = await adminClient
      .from('products')
      .select('id, org_id, name, selling_price, is_active')
      .in('id', productIds)
      .eq('org_id', orgId)
      .eq('is_active', true)

    if (productsError) {
      return new Response(JSON.stringify({ error: productsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const productMap = new Map(products?.map((p) => [p.id, p]))
    const missingProducts = payload.items.filter((i) => !productMap.has(i.product_id))
    if (missingProducts.length > 0) {
      return new Response(JSON.stringify({ error: 'Produit non disponible' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: stock, error: stockError } = await adminClient
      .from('stock_levels')
      .select('product_id, quantity')
      .eq('location_id', locationId)
      .in('product_id', productIds)

    if (stockError) {
      return new Response(JSON.stringify({ error: stockError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stockMap = new Map(stock?.map((s) => [s.product_id, s.quantity]))
    const insufficient = payload.items.find((i) => (stockMap.get(i.product_id) ?? 0) < i.quantity)
    if (insufficient) {
      return new Response(JSON.stringify({ error: 'Stock insuffisant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upsert customer contact
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
        return new Response(
          JSON.stringify({ error: contactError?.message ?? 'Contact creation failed' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
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
      return new Response(JSON.stringify({ error: orderError?.message ?? 'Order failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const movementIds = (orderResult as { movement_ids: string[] }).movement_ids

    return new Response(
      JSON.stringify({
        order_id: movementIds[0] ?? null,
        order_number: orderNumber,
        movement_count: movementIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
