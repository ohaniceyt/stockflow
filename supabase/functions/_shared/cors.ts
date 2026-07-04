// Shared CORS helper for StockFlow Edge Functions.
// Validates the request origin against an allow-list and returns appropriate headers.

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
]

function getAllowedOrigins(): string[] {
  const envOrigin = Deno.env.get('PUBLIC_APP_URL')
  const origins: string[] = envOrigin ? [envOrigin] : []
  return [...origins, ...DEFAULT_ALLOWED_ORIGINS]
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const allowed = getAllowedOrigins()
  const requestOrigin = req.headers.get('origin') ?? ''
  const allowedOrigin = allowed.includes(requestOrigin) ? requestOrigin : ''

  // Only echo ACAO for explicitly allowed origins. For untrusted origins the
  // header is omitted so the browser blocks the cross-origin request.
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-platform-challenge-id',
  }
}

export function corsResponse(req: Request, status = 204): Response {
  return new Response(null, {
    status,
    headers: getCorsHeaders(req),
  })
}
