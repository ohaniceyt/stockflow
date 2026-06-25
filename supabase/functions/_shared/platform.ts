import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from './auth.ts'

export type PlatformAdminRole = 'super_admin' | 'moderator'

export interface PlatformAdminIdentity {
  authUserId: string
  email?: string
  role: PlatformAdminRole
}

export async function requirePlatformAdmin(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  minRole?: PlatformAdminRole,
  requireChallenge?: boolean
): Promise<PlatformAdminIdentity | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return null

  const claims = await verifyToken(supabaseUrl, anonKey, token)
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

  if (requireChallenge) {
    const challengeId = req.headers.get('X-Platform-Challenge-Id')
    if (!challengeId) return null

    const now = new Date().toISOString()
    const { data: consumedChallenges } = await adminClient
      .from('platform_admin_challenges')
      .update({ consumed_at: now })
      .eq('id', challengeId)
      .eq('auth_user_id', claims.sub)
      .is('consumed_at', null)
      .gt('expires_at', now)
      .select('id')

    if (!consumedChallenges || consumedChallenges.length === 0) {
      return null
    }
  }

  return {
    authUserId: platformAdmin.auth_user_id,
    email: platformAdmin.email ?? undefined,
    role,
  }
}
