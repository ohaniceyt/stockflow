import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

// Legacy PIN-first login endpoint.
// This function is no longer used by the current email/password + AppLock flow.
// It returns 410 Gone to signal client applications to migrate to Supabase Auth.

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  return new Response(
    JSON.stringify({
      error: 'Deprecated',
      message:
        'The PIN-first login endpoint is no longer supported. Use Supabase Auth email/password sign-in and the initialize-session endpoint instead.',
    }),
    {
      status: 410,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    }
  )
})
