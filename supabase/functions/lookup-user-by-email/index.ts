import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

/**
 * This public user lookup endpoint is permanently disabled.
 *
 * The original implementation exposed membership roles, organization IDs and
 * organization names to unauthenticated callers, enabling user enumeration.
 * If a replacement is needed, it must require authentication and an explicit
 * authorization check.
 */
Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  return new Response(
    JSON.stringify({
      error: 'This endpoint is disabled. Use an authenticated alternative or contact support.',
    }),
    {
      status: 410,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    }
  )
})
