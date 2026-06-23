import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from './auth.ts'

export async function requirePlatformAdmin(
  req: Request,
  adminClient: ReturnType<typeof createClient>
): Promise<{ authUserId: string; email?: string } | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const claims = parseJwt(token)
  if (!claims?.sub) return null

  const { data: platformAdmin } = await adminClient
    .from('platform_admins')
    .select('auth_user_id, email')
    .eq('auth_user_id', claims.sub)
    .eq('is_active', true)
    .maybeSingle()

  if (!platformAdmin) return null

  return { authUserId: platformAdmin.auth_user_id, email: platformAdmin.email ?? undefined }
}
