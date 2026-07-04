/**
 * Shared HTTP error response helpers for StockFlow Edge Functions.
 *
 * These helpers guarantee consistent JSON shape and CORS headers across functions.
 */

import { getCorsHeaders } from './cors.ts'

export interface ErrorBody {
  error: string
  details?: string | unknown[]
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

export function badRequest(req: Request, message: string, details?: unknown): Response {
  return jsonResponse(req, { error: message, ...(details !== undefined ? { details } : {}) }, 400)
}

export function unauthorized(req: Request, message = 'Unauthorized'): Response {
  return jsonResponse(req, { error: message }, 401)
}

export function forbidden(req: Request, message = 'Forbidden'): Response {
  return jsonResponse(req, { error: message }, 403)
}

export function notFound(req: Request, message = 'Not found'): Response {
  return jsonResponse(req, { error: message }, 404)
}

export function conflict(req: Request, message: string): Response {
  return jsonResponse(req, { error: message }, 409)
}

export function tooManyRequests(req: Request, message = 'Too many requests'): Response {
  return jsonResponse(req, { error: message }, 429, {
    'Retry-After': '60',
  })
}

export function internalError(req: Request, logMessage: string): Response {
  // Log internally only; never leak server details to the client.
  console.error(logMessage)
  return jsonResponse(req, { error: 'Internal error' }, 500)
}
