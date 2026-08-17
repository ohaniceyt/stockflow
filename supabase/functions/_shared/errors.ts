/**
 * Shared client-safe error response helpers.
 *
 * Internal/database error details must be logged server-side only.
 * These helpers ensure 500 responses never leak stacks, SQL or schemas.
 */

import { getCorsHeaders } from './cors.ts'

export function internalErrorResponse(
  req: Request,
  status: number,
  clientMessage: string,
): Response {
  return new Response(JSON.stringify({ error: clientMessage }), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

export function genericInternalErrorResponse(req: Request): Response {
  return internalErrorResponse(req, 500, 'Internal server error')
}
