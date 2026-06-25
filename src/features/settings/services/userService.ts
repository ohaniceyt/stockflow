import { supabase } from '@/services/supabase'
import type { User } from '@/types'

export interface UpdateProfileInput {
  name: string
  phone?: string | null
}

export async function fetchCurrentUser(): Promise<User> {
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  if (!accessToken) {
    throw new Error('Non authentifié')
  }

  const userId = session.data.session?.user.id
  if (!userId) {
    throw new Error('Non authentifié')
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, created_at, updated_at')
    .eq('id', userId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (error || !data) throw new Error(error?.message ?? 'Profil non trouvé')

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    emailVerified: true,
    activeOrgId: null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function updateCurrentUserProfile(input: UpdateProfileInput): Promise<User> {
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token
  const userId = session.data.session?.user.id
  if (!accessToken || !userId) {
    throw new Error('Non authentifié')
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      name: input.name.trim(),
      phone: input.phone?.trim() ?? null,
    })
    .eq('id', userId)
    .select('id, name, email, phone, created_at, updated_at')
    .single()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (error || !data) throw new Error(error?.message ?? 'Mise à jour échouée')

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    emailVerified: true,
    activeOrgId: null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
