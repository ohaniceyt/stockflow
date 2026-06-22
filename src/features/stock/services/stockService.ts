import { supabase } from '@/services/supabase'
import type { MovementType, Product } from '@/types'

export interface StockItem {
  id: string
  productId: string
  productName: string
  productUnit: string
  threshold: number
  locationId: string
  locationName: string
  quantity: number
  updatedAt: string
}

export async function fetchStock(): Promise<StockItem[]> {
  const [
    { data: stockLevels, error: stockError },
    { data: products, error: productsError },
    { data: locations, error: locationsError },
  ] = await Promise.all([
    supabase.from('stock_levels').select('*').order('updated_at'),
    supabase.from('products').select('id, name, unit, threshold'),
    supabase.from('locations').select('id, name'),
  ])

  if (stockError) throw new Error(stockError.message)
  if (productsError) throw new Error(productsError.message)
  if (locationsError) throw new Error(locationsError.message)

  const productMap = new Map(
    products.map((p) => [p.id, p as Pick<Product, 'id' | 'name' | 'unit' | 'threshold'>])
  )
  const locationMap = new Map(locations.map((l) => [l.id, l.name]))

  return stockLevels.map((row) => {
    const product = productMap.get(row.product_id)
    return {
      id: row.id,
      productId: row.product_id,
      productName: product?.name ?? 'Inconnu',
      productUnit: product?.unit ?? 'unité',
      threshold: product?.threshold ?? 0,
      locationId: row.location_id,
      locationName: locationMap.get(row.location_id) ?? 'Inconnu',
      quantity: row.quantity,
      updatedAt: row.updated_at,
    }
  })
}

export async function recordMovement(input: {
  productId: string
  locationId: string
  targetLocationId?: string | null
  type: MovementType
  quantity: number
  reason?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('record_movement', {
    p_product_id: input.productId,
    p_location_id: input.locationId,
    p_target_location_id: input.targetLocationId ?? null,
    p_type: input.type,
    p_quantity: input.quantity,
    p_reason: input.reason ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
