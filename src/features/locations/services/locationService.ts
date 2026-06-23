import { supabase } from '@/services/supabase'
import { edgeFetch } from '@/services/edgeFunctions'
import type { Location } from '@/types'
import type { Database } from '@/types/database'
import type { LocationFormData } from '../schemas/locationSchema'

type LocationRow = Database['public']['Tables']['locations']['Row']
type LocationInsert = Database['public']['Tables']['locations']['Insert']
type LocationUpdate = Database['public']['Tables']['locations']['Update']

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

export async function createLocation(orgId: string, input: LocationFormData): Promise<Location> {
  const payload: LocationInsert = {
    org_id: orgId,
    name: input.name,
    description: input.description ?? null,
    address: input.address ?? null,
    is_default: false,
  }

  const data = await edgeFetch<LocationRow>('create-location', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapRowToLocation(data)
}

export async function updateLocation(id: string, input: LocationFormData): Promise<Location> {
  const update: LocationUpdate = {
    name: input.name,
    description: input.description ?? null,
    address: input.address ?? null,
  }

  const { data, error } = await supabase
    .from('locations')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapRowToLocation(data)
}

export async function setDefaultLocation(id: string, orgId: string): Promise<Location> {
  // Unset current default
  const { error: unsetError } = await supabase
    .from('locations')
    .update({ is_default: false })
    .eq('org_id', orgId)
    .eq('is_default', true)
    .neq('id', id)

  if (unsetError) {
    throw new Error(unsetError.message)
  }

  // Set new default
  const { data, error } = await supabase
    .from('locations')
    .update({ is_default: true })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapRowToLocation(data)
}
