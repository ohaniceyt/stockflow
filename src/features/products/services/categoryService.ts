import { supabase } from '@/services/supabase'
import type { Category } from '@/types'
import type { Database } from '@/types/database'

type CategoryRow = Database['public']['Tables']['categories']['Row']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']

function mapRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchCategories(orgId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('org_id', orgId)
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return data.map(mapRowToCategory)
}

export async function createCategory(orgId: string, name: string): Promise<Category> {
  const payload: CategoryInsert = {
    org_id: orgId,
    name: name.trim(),
  }

  const { data, error } = await supabase.from('categories').insert(payload).select().single()

  if (error) {
    throw new Error(error.message)
  }

  return mapRowToCategory(data)
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  const update: CategoryUpdate = { name: name.trim() }

  const { data, error } = await supabase
    .from('categories')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapRowToCategory(data)
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}
