import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { encodeBase64, decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface Payload {
  password: string
}

const PBKDF2_ITERATIONS = 100_000
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 30

function parseHash(hash: string): { salt: Uint8Array; hash: Uint8Array } | null {
  const parts = hash.split('$')
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return null
  try {
    return {
      salt: decodeBase64(parts[1]),
      hash: decodeBase64(parts[2]),
    }
  } catch {
    return null
  }
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return `pbkdf2$${encodeBase64(salt)}$${encodeBase64(new Uint8Array(derived))}`
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseHash(storedHash)
  if (!parsed) return false
  const computed = await hashPassword(password, parsed.salt)
  return constantTimeEqual(computed, storedHash)
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env vars')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const platformAdmin = await requirePlatformAdmin(req, adminClient)
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { password }: Payload = await req.json()
    if (!password || typeof password !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: adminRecord, error: adminError } = await adminClient
      .from('platform_admins')
      .select('password_hash, failed_challenge_attempts, locked_until')
      .eq('auth_user_id', platformAdmin.authUserId)
      .single()

    if (adminError || !adminRecord) {
      return new Response(JSON.stringify({ error: 'Admin record not found' }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const lockedUntil = adminRecord.locked_until ? new Date(adminRecord.locked_until) : null
    if (lockedUntil && lockedUntil > new Date()) {
      return new Response(
        JSON.stringify({
          error: 'Account locked due to too many failed attempts. Try again later.',
          locked_until: adminRecord.locked_until,
        }),
        {
          status: 429,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    if (!adminRecord.password_hash) {
      return new Response(
        JSON.stringify({
          error: 'Platform admin password not configured. Set a password before using challenges.',
        }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const passwordValid = await verifyPassword(password, adminRecord.password_hash)
    if (!passwordValid) {
      const newFailedAttempts = (adminRecord.failed_challenge_attempts ?? 0) + 1
      const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS
      const update: {
        failed_challenge_attempts: number
        locked_until?: string
      } = {
        failed_challenge_attempts: newFailedAttempts,
      }
      if (shouldLock) {
        update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      }
      await adminClient
        .from('platform_admins')
        .update(update)
        .eq('auth_user_id', platformAdmin.authUserId)

      await adminClient.from('platform_audit_logs').insert({
        actor_id: platformAdmin.authUserId,
        actor_role: platformAdmin.role,
        action: 'challenge_failed',
        target_type: 'platform_admin',
        target_id: platformAdmin.authUserId,
        metadata: { failed_attempts: newFailedAttempts, locked: shouldLock },
      })

      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Reset failed attempts on successful password verification.
    await adminClient
      .from('platform_admins')
      .update({ failed_challenge_attempts: 0, locked_until: null })
      .eq('auth_user_id', platformAdmin.authUserId)

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const challengeHash = await hashPassword(password, salt)

    const { data: challenge, error } = await adminClient
      .from('platform_admin_challenges')
      .insert({
        auth_user_id: platformAdmin.authUserId,
        challenge_hash: challengeHash,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .select('id, expires_at')
      .single()

    if (error || !challenge) {
      return new Response(
        JSON.stringify({ error: error?.message ?? 'Failed to create challenge' }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    await adminClient.from('platform_audit_logs').insert({
      actor_id: platformAdmin.authUserId,
      actor_role: platformAdmin.role,
      action: 'challenge_created',
      target_type: 'platform_admin_challenge',
      target_id: challenge.id,
      metadata: {},
    })

    return new Response(
      JSON.stringify({
        challenge_id: challenge.id,
        expires_at: challenge.expires_at,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
