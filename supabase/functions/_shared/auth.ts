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
