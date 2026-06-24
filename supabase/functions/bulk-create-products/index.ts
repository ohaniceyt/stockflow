import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'

interface BulkProductInput {
  name: string
  category?: string | null
  unit?: string
  threshold?: number
  cost_price?: number
  selling_price?: number
  supplier?: string | null
  description?: string | null
  barcode?: string | null
  is_active?: boolean
}

interface BulkCreateProductsPayload {
  org_id: string
  products: BulkProductInput[]
}

const MAX_BATCH_SIZE = 500

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, details?: Record<string, unknown>, status = 500) {
  return jsonResponse(
    { error: { message, details }, created: 0, total: 0, errors: [message] },
    status
  )
}

function normalizeName(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const str = String(value).trim()
  return str.length > 0 ? str : null
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null) return fallback
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
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
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const claims = parseJwt(token)
    if (!claims?.sub) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const operator = await getCurrentMembership(adminClient, claims.sub)

    if (!operator || !['super_admin', 'admin'].includes(operator.role)) {
      return jsonResponse(
        {
          error: 'Forbidden',
          debug: 'Operator not found or insufficient role',
        },
        403
      )
    }

    const payload: BulkCreateProductsPayload = await req.json()
    const { org_id, products } = payload

    if (!org_id || !Array.isArray(products)) {
      return jsonResponse({ error: 'Invalid request' }, 400)
    }

    if (operator.org_id !== org_id) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    if (products.length === 0) {
      return jsonResponse({ created: 0, total: 0, errors: [] })
    }

    if (products.length > MAX_BATCH_SIZE) {
      return jsonResponse(
        { error: `Batch too large. Maximum ${MAX_BATCH_SIZE} products allowed.` },
        400
      )
    }

    const limits = await getOrgLimits(adminClient, org_id)
    if (!limits) {
      return jsonResponse({ error: 'Could not load organization limits' }, 500)
    }
    if (limits.isSuspended) {
      return jsonResponse({ error: 'Organization suspended' }, 403)
    }
    if (isAtLimit(limits.usedProducts + products.length - 1, limits.maxProducts)) {
      return jsonResponse({ error: 'Product limit reached for this plan' }, 403)
    }

    // 1. Collect unique category names.
    const categoryNames = new Set<string>()
    const validProducts: BulkProductInput[] = []
    const errors: string[] = []

    products.forEach((item, index) => {
      const name = normalizeName(item.name)
      if (!name) {
        errors.push(`Ligne ${index + 1}: le nom est requis`)
        return
      }
      const category = normalizeName(item.category)
      if (category) categoryNames.add(category)

      validProducts.push({
        name,
        category,
        unit: normalizeName(item.unit) ?? 'unité',
        threshold: Math.max(0, Math.round(normalizeNumber(item.threshold, 0))),
        cost_price: Math.max(0, normalizeNumber(item.cost_price, 0)),
        selling_price: Math.max(0, normalizeNumber(item.selling_price, 0)),
        supplier: normalizeName(item.supplier),
        description: normalizeName(item.description),
        barcode: normalizeName(item.barcode),
        is_active: item.is_active !== false,
      })
    })

    if (validProducts.length === 0) {
      return jsonResponse({ created: 0, total: products.length, errors }, 400)
    }

    // 2. Build category id map by upserting categories.
    const categoryIdMap = new Map<string, string>()
    if (categoryNames.size > 0) {
      const namesArray = Array.from(categoryNames)
      const { data: existingCategories } = await adminClient
        .from('categories')
        .select('id, name')
        .eq('org_id', org_id)
        .in('name', namesArray)

      if (existingCategories) {
        for (const cat of existingCategories) {
          categoryIdMap.set(cat.name, cat.id)
        }
      }

      for (const name of namesArray) {
        if (categoryIdMap.has(name)) continue
        const { data: inserted, error: insertError } = await adminClient
          .from('categories')
          .insert({ org_id, name })
          .select('id')
          .single()

        if (insertError || !inserted) {
          // Name may have been created concurrently; fetch it.
          const { data: conflict } = await adminClient
            .from('categories')
            .select('id')
            .eq('org_id', org_id)
            .eq('name', name)
            .single()
          if (conflict?.id) {
            categoryIdMap.set(name, conflict.id)
          }
        } else {
          categoryIdMap.set(name, inserted.id)
        }
      }
    }

    // 3. Build product rows and detect duplicates against existing products.
    const productRows = validProducts.map((p) => ({
      org_id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      threshold: p.threshold,
      cost_price: p.cost_price,
      selling_price: p.selling_price,
      supplier: p.supplier,
      description: p.description,
      barcode: p.barcode,
      is_active: p.is_active,
    }))

    const productNames = productRows.map((p) => p.name)
    const { data: existingProducts } = await adminClient
      .from('products')
      .select('name')
      .eq('org_id', org_id)
      .in('name', productNames)

    const existingNames = new Set((existingProducts ?? []).map((p) => p.name))

    const newRows = productRows.filter((p) => !existingNames.has(p.name))
    const duplicateCount = productRows.length - newRows.length

    if (duplicateCount > 0) {
      errors.push(
        `${duplicateCount} produit(s) ignoré(s) car le nom existe déjà dans cette organisation.`
      )
    }

    if (newRows.length === 0) {
      return jsonResponse({
        created: 0,
        total: products.length,
        errors,
      })
    }

    // 4. Bulk insert only new products.
    console.log('bulk-create-products: inserting', newRows.length, 'new rows for org', org_id)
    console.log('bulk-create-products: first row sample', JSON.stringify(newRows[0]))

    const { data: insertedProducts, error: insertError } = await adminClient
      .from('products')
      .insert(newRows)
      .select('id')

    console.log('bulk-create-products: insertError', insertError)
    console.log('bulk-create-products: insertedProducts count', insertedProducts?.length ?? 0)

    if (insertError) {
      return errorResponse(`Erreur lors de l'insertion des produits: ${insertError.message}`, {
        code: insertError.code,
        hint: insertError.hint,
      })
    }

    const created = insertedProducts?.length ?? 0
    if (created === 0 && newRows.length > 0) {
      errors.push('Aucun produit inséré : la base de données a retourné 0 lignes créées.')
    }

    return jsonResponse({
      created,
      total: products.length,
      errors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('bulk-create-products: unhandled exception', err)
    return errorResponse(message, { stack: err instanceof Error ? err.stack : undefined })
  }
})
