import { supabase } from '@/services/supabase'
import { edgeFetch } from '@/services/edgeFunctions'
import type { Product } from '@/types'

export interface StorefrontProduct extends Product {
  available: number
  locationId: string
}

export interface StorefrontOrganization {
  id: string
  name: string
  slug: string
  currency: string
  timezone: string
  storefrontLocationId: string
}

export interface StorefrontOrderInput {
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  address?: string | null
  items: { productId: string; quantity: number; unitPrice: number }[]
}

export interface StorefrontOrderResult {
  orderId: string
  orderNumber: string
}

export async function getStorefrontBySlug(
  orgSlug: string
): Promise<{ organization: StorefrontOrganization | null; products: StorefrontProduct[] }> {
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select(
      'id, name, slug, currency, timezone, has_storefront_enabled, storefront_location_id'
    )
    .eq('slug', orgSlug)
    .eq('has_storefront_enabled', true)
    .single()

  if (orgError) {
    return { organization: null, products: [] }
  }

  const locationId = orgData.storefront_location_id
  if (!locationId) {
    return { organization: null, products: [] }
  }

  const [{ data: products, error: productsError }, { data: stock, error: stockError }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, org_id, name, category, unit, threshold, cost_price, selling_price, supplier, description, barcode, is_active, created_at, updated_at')
        .eq('org_id', orgData.id)
        .eq('is_active', true),
      supabase.from('stock_levels').select('product_id, location_id, quantity').eq('location_id', locationId),
    ])

  if (productsError) throw new Error(productsError.message)
  if (stockError) throw new Error(stockError.message)

  const stockRows = stock
  const stockMap = new Map(stockRows.map((s) => [`${s.product_id}-${s.location_id}`, s.quantity]))

  const productRows = products
  const mappedProducts: StorefrontProduct[] = productRows
    .filter((p) => (stockMap.get(`${p.id}-${locationId}`) ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      orgId: p.org_id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      threshold: p.threshold,
      costPrice: p.cost_price,
      sellingPrice: p.selling_price,
      supplier: p.supplier,
      description: p.description,
      barcode: p.barcode,
      isActive: p.is_active,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      available: stockMap.get(`${p.id}-${locationId}`) ?? 0,
      locationId,
    }))

  return {
    organization: {
      id: orgData.id,
      name: orgData.name,
      slug: orgData.slug,
      currency: orgData.currency,
      timezone: orgData.timezone,
      storefrontLocationId: locationId,
    },
    products: mappedProducts,
  }
}

export async function createStorefrontOrder(
  orgSlug: string,
  input: StorefrontOrderInput
): Promise<StorefrontOrderResult> {
  const result = await edgeFetch('create-storefront-order', {
    method: 'POST',
    body: JSON.stringify({ org_slug: orgSlug, ...input }),
  })
  return result as StorefrontOrderResult
}
