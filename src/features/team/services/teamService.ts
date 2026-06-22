import { supabase } from '@/services/supabase'
import type { User } from '@/types'
import type { Database } from '@/types/database'

type UserRow = Database['public']['Tables']['users']['Row']
type UserUpdate = Database['public']['Tables']['users']['Update']

function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchTeamUsers(orgId: string): Promise<User[]> {
  const { data, error } = await supabase.from('users').select('*').eq('org_id', orgId).order('name')

  if (error) {
    throw new Error(error.message)
  }

  return data.map(mapRowToUser)
}

export async function updateUserActive(id: string, isActive: boolean): Promise<User> {
  const update: UserUpdate = { is_active: isActive }
  const { data, error } = await supabase.from('users').update(update).eq('id', id).select().single()

  if (error) {
    throw new Error(error.message)
  }

  return mapRowToUser(data)
}

export async function resetUserPin(userId: string, newPin: string): Promise<void> {
  const session = supabase.auth.getSession()
  const accessToken = (await session).data.session?.access_token
  if (!accessToken) {
    throw new Error('Non authentifié')
  }

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
  const response = await fetch(`${supabaseUrl}/functions/v1/reset-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    },
    body: JSON.stringify({ userId, newPin }),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: { message: string } }
    throw new Error(data.error?.message ?? 'Échec de la réinitialisation du PIN')
  }
}
