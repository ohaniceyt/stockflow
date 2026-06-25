import { supabase } from '@/services/supabase'

export interface StockItem {
  id: string
  productId: string
  productName: string
  productUnit: string
  category: string | null
  barcode: string | null
  threshold: number
  costPrice: number
  sellingPrice: number
  locationId: string
  locationName: string
  quantity: number
  updatedAt: string
}

export async function fetchStock(orgId: string): Promise<StockItem[]> {
  if (!orgId) {
    throw new Error('Cannot fetch stock without an organization id')
  }

  const [{ data: products, error: productsError }, { data: locations, error: locationsError }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, name, unit, category, barcode, threshold, cost_price, selling_price')
        .eq('org_id', orgId),
      supabase.from('locations').select('id, name').eq('org_id', orgId),
    ])

  if (productsError) throw new Error(productsError.message)
  if (locationsError) throw new Error(locationsError.message)

  const productIds = products.map((p) => p.id)
  const locationIds = locations.map((l) => l.id)

  if (productIds.length === 0 || locationIds.length === 0) return []

  const { data: stockLevels, error: stockError } = await supabase
    .from('stock_levels')
    .select('*')
    .in('product_id', productIds)
    .order('updated_at')

  if (stockError) throw new Error(stockError.message)

  const productMap = new Map(
    products.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        unit: p.unit,
        category: p.category,
        barcode: p.barcode,
        threshold: p.threshold,
        costPrice: p.cost_price,
        sellingPrice: p.selling_price,
      },
    ])
  )
  const locationMap = new Map(locations.map((l) => [l.id, l.name]))

  return stockLevels
    .filter((row) => productMap.has(row.product_id) && locationMap.has(row.location_id))
    .map((row) => {
      const product = productMap.get(row.product_id)
      return {
        id: row.id,
        productId: row.product_id,
        productName: product?.name ?? 'Inconnu',
        productUnit: product?.unit ?? 'unité',
        category: product?.category ?? null,
        barcode: product?.barcode ?? null,
        threshold: product?.threshold ?? 0,
        costPrice: product?.costPrice ?? 0,
        sellingPrice: product?.sellingPrice ?? 0,
        locationId: row.location_id,
        locationName: locationMap.get(row.location_id) ?? 'Inconnu',
        quantity: row.quantity,
        updatedAt: row.updated_at,
      }
    })
}
