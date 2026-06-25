import { supabase } from '@/services/supabase'
import { edgeFetch } from '@/services/edgeFunctions'
import type { Product } from '@/types'
import type { Database } from '@/types/database'

type ProductRow = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

function mapRowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    threshold: row.threshold,
    costPrice: row.cost_price,
    sellingPrice: row.selling_price,
    supplier: row.supplier,
    description: row.description,
    barcode: row.barcode,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchProducts(orgId: string): Promise<Product[]> {
  // RLS filters by org; the explicit org_id filter narrows the query and documents the contract.
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('org_id', orgId)
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return data.map(mapRowToProduct)
}

export async function createProduct(
  orgId: string,
  input: Omit<Product, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>
): Promise<Product> {
  const payload: ProductInsert = {
    org_id: orgId,
    name: input.name,
    category: input.category,
    unit: input.unit,
    threshold: input.threshold,
    cost_price: input.costPrice,
    selling_price: input.sellingPrice,
    supplier: input.supplier,
    description: input.description,
    barcode: input.barcode,
    is_active: input.isActive,
  }

  // create-product is an edge function that applies RLS and quota checks server-side.
  const data = await edgeFetch<ProductRow>('create-product', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapRowToProduct(data)
}

export async function updateProduct(
  id: string,
  orgId: string,
  input: Partial<Omit<Product, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>
): Promise<Product> {
  const update: ProductUpdate = {}
  if (input.name !== undefined) update.name = input.name
  if (input.category !== undefined) update.category = input.category ?? null
  if (input.unit !== undefined) update.unit = input.unit
  if (input.threshold !== undefined) update.threshold = input.threshold
  if (input.costPrice !== undefined) update.cost_price = input.costPrice
  if (input.sellingPrice !== undefined) update.selling_price = input.sellingPrice
  if (input.supplier !== undefined) update.supplier = input.supplier ?? null
  if (input.description !== undefined) update.description = input.description ?? null
  if (input.barcode !== undefined) update.barcode = input.barcode ?? null
  if (input.isActive !== undefined) update.is_active = input.isActive

  // Authorization is enforced by RLS; org scoping prevents accidental cross-org edits.
  const { data, error } = await supabase
    .from('products')
    .update(update)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapRowToProduct(data)
}
