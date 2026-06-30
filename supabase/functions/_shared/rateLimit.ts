/**
 * Shared IP and email rate-limit helpers for Supabase Edge Functions.
 *
 * Tracks requests in the `rate_limit_requests` table (created by migration
 * 00000000000040_api_request_logs.sql). Limits are enforced per window.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

export interface RateLimitWindow {
  maxRequests: number
  windowMinutes: number
}

export interface RateLimitKey {
  key: string
  type: 'ip' | 'email'
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') ?? req.headers.get('cf-connecting-ip') ?? null
}

export function rateLimitCutoff(windowMinutes: number): string {
  return new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
}

export async function isRateLimited(
  adminClient: ReturnType<typeof createClient>,
  key: RateLimitKey,
  window: RateLimitWindow
): Promise<boolean> {
  if (!key.key) return false

  const { count, error } = await adminClient
    .from('rate_limit_requests')
    .select('*', { count: 'exact', head: true })
    .eq('key', key.key)
    .eq('type', key.type)
    .gte('created_at', rateLimitCutoff(window.windowMinutes))

  if (error) {
    console.error('Rate-limit count failed:', error)
    // Fail open on counting errors so the app keeps working, but log loudly.
    return false
  }

  return (count ?? 0) >= window.maxRequests
}

export async function recordRateLimitRequest(
  adminClient: ReturnType<typeof createClient>,
  key: RateLimitKey
): Promise<void> {
  if (!key.key) return
  const { error } = await adminClient.from('rate_limit_requests').insert({
    key: key.key,
    type: key.type,
  })
  if (error) {
    console.error('Failed to record rate-limit request:', error)
  }
}
