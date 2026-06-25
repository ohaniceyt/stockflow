import { supabase, supabaseKey } from '@/services/supabase'
import type { TeamMember, UserRole } from '@/types'
import { USER_ROLES } from '../constants'

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return fallback
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value)
}

function mapMembershipRow(row: Record<string, unknown>): TeamMember {
  const users = (row.users as Record<string, unknown> | undefined) ?? {}
  return {
    membershipId: asString(row.id),
    userId: asString(row.user_id ?? users.id),
    name: asString(users.name),
    email: asString(users.email),
    role: USER_ROLES.includes(asString(row.role) as UserRole)
      ? (asString(row.role) as UserRole)
      : 'reader',
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at ? asString(row.last_login_at) : null,
  }
}

export async function fetchTeamUsers(): Promise<TeamMember[]> {
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  if (!accessToken) {
    throw new Error('Non authentifié')
  }

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
  const response = await fetch(`${supabaseUrl}/functions/v1/list-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseKey,
    },
  })

  const data = (await response.json().catch(() => ({}))) as {
    users?: Record<string, unknown>[]
    error?: { message: string }
  }

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Échec du chargement de l’équipe')
  }

  return (data.users ?? []).map(mapMembershipRow)
}

export async function updateUserActive(
  membershipId: string,
  isActive: boolean
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('organization_memberships')
    .update({ is_active: isActive })
    .eq('id', membershipId)
    .select('id, role, is_active, user_id, users!inner(id, name, email), last_login_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapMembershipRow(data)
}

export async function resetUserPin(membershipId: string, newPin: string): Promise<void> {
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  if (!accessToken) {
    throw new Error('Non authentifié')
  }

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
  const response = await fetch(`${supabaseUrl}/functions/v1/reset-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify({ userId: membershipId, newPin }),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: { message: string } }
    throw new Error(data.error?.message ?? 'Échec de la réinitialisation du PIN')
  }
}

export async function createUser(input: {
  name: string
  email: string
  role: UserRole
}): Promise<{ tempPin: string }> {
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  if (!accessToken) {
    throw new Error('Non authentifié')
  }

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL)
  const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify(input),
  })

  const data = (await response.json().catch(() => ({}))) as {
    tempPin?: string
    error?: { message: string }
  }

  if (!response.ok || !data.tempPin) {
    throw new Error(data.error?.message ?? 'Échec de la création')
  }

  return { tempPin: data.tempPin }
}
