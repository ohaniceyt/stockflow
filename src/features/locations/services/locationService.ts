import { supabase } from '@/services/supabase'
import type { Location } from '@/types'
import type { Database } from '@/types/database'

type LocationRow = Database['public']['Tables']['locations']['Row']

function mapRowToLocation(row: LocationRow): Location {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    address: row.address,
    isDefault: row.is_default,
    createdAt: row.created_at,
  }
}

export async function fetchLocations(orgId: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('org_id', orgId)
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return data.map(mapRowToLocation)
}
