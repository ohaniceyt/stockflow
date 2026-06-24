import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from './auth.ts'

export type PlatformAdminRole = 'super_admin' | 'moderator'

export interface PlatformAdminIdentity {
  authUserId: string
  email?: string
  role: PlatformAdminRole
}

export async function requirePlatformAdmin(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  minRole?: PlatformAdminRole
): Promise<PlatformAdminIdentity | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const claims = parseJwt(token)
  if (!claims?.sub) return null

  const { data: platformAdmin } = await adminClient
    .from('platform_admins')
    .select('auth_user_id, email, role')
    .eq('auth_user_id', claims.sub)
    .eq('is_active', true)
    .maybeSingle()

  if (!platformAdmin) return null

  const role = (platformAdmin.role as PlatformAdminRole) ?? 'moderator'

  if (minRole === 'super_admin' && role !== 'super_admin') {
    return null
  }

  return {
    authUserId: platformAdmin.auth_user_id,
    email: platformAdmin.email ?? undefined,
    role,
  }
}
