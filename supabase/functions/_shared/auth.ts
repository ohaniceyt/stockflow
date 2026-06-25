import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

export interface VerifiedToken {
  sub: string
  email?: string
  role?: string
}

/**
 * Verify a Supabase JWT by asking Supabase to validate it.
 * This checks signature, expiry and revocation, unlike parseJwt which only decodes.
 */
export async function verifyToken(
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string
): Promise<VerifiedToken | null> {
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) {
    console.error('JWT verification failed:', error?.message ?? 'no user')
    return null
  }

  return {
    sub: data.user.id,
    email: data.user.email ?? undefined,
    role: (data.user.user_metadata?.role as string | undefined) ?? undefined,
  }
}

/**
 * Decode a JWT without verifying it. Only safe for non-security uses where the token
 * will be verified later (e.g. by verifyToken or by passing it to a user client).
 * @deprecated Use verifyToken for authentication decisions.
 */
export function parseJwt(token: string): { sub?: string; email?: string; role?: string } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as {
      sub?: string
      email?: string
      user_metadata?: { role?: string }
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.user_metadata?.role,
    }
  } catch {
    return null
  }
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.replace('Bearer ', '').trim()
}
