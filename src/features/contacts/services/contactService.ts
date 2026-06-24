import { supabase } from '@/services/supabase'
import { edgeFetch } from '@/services/edgeFunctions'
import type { Contact } from '@/types'
import type { Database } from '@/types/database'
import type { ContactFormData } from '../schemas/contactSchema'

type ContactRow = Database['public']['Tables']['contacts']['Row']
type ContactInsert = Database['public']['Tables']['contacts']['Insert']
type ContactUpdate = Database['public']['Tables']['contacts']['Update']

function mapRowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    orgId: row.org_id,
    type: row.type,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    taxId: row.tax_id,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchContacts(orgId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('org_id', orgId)
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return data.map(mapRowToContact)
}

export async function createContact(orgId: string, input: ContactFormData): Promise<Contact> {
  const payload: ContactInsert = {
    org_id: orgId,
    type: input.type,
    name: input.name,
    email: input.email?.trim() ? input.email.trim() : null,
    phone: input.phone?.trim() ? input.phone.trim() : null,
    address: input.address?.trim() ? input.address.trim() : null,
    tax_id: input.taxId?.trim() ? input.taxId.trim() : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    is_active: input.isActive,
  }

  const data = await edgeFetch<ContactRow>('create-contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapRowToContact(data)
}

export async function updateContact(id: string, input: Partial<ContactFormData>): Promise<Contact> {
  const update: ContactUpdate = {}
  if (input.name !== undefined) update.name = input.name
  if (input.email !== undefined) update.email = input.email?.trim() ? input.email.trim() : null
  if (input.phone !== undefined) update.phone = input.phone?.trim() ? input.phone.trim() : null
  if (input.address !== undefined)
    update.address = input.address?.trim() ? input.address.trim() : null
  if (input.taxId !== undefined) update.tax_id = input.taxId?.trim() ? input.taxId.trim() : null
  if (input.notes !== undefined) update.notes = input.notes?.trim() ? input.notes.trim() : null
  if (input.isActive !== undefined) update.is_active = input.isActive

  const { data, error } = await supabase
    .from('contacts')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapRowToContact(data)
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
}
