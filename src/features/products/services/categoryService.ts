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
  // RLS filters by org; the explicit org_id filter documents the scoping contract.
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

  // RLS restricts category management to admins of the org; org_id ties the row to the org.
  const { data, error } = await supabase.from('categories').insert(payload).select().single()

  if (error) {
    throw new Error(error.message)
  }

  return mapRowToCategory(data)
}

export async function updateCategory(id: string, orgId: string, name: string): Promise<Category> {
  const update: CategoryUpdate = { name: name.trim() }

  // Authorization relies on RLS; org_id scoping prevents accidental cross-org edits.
  const { data, error } = await supabase
    .from('categories')
    .update(update)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapRowToCategory(data)
}

export async function deleteCategory(id: string, orgId: string): Promise<void> {
  // Authorization relies on RLS; org_id scoping prevents accidental cross-org deletes.
  const { error } = await supabase.from('categories').delete().eq('id', id).eq('org_id', orgId)

  if (error) {
    throw new Error(error.message)
  }
}
