import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface Payload {
  password: string
  targetAdminId?: string
}

const MIN_PASSWORD_LENGTH = 12

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
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return `pbkdf2$${encodeBase64(salt)}$${encodeBase64(new Uint8Array(derived))}`
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

    // Only super_admins may set platform admin passwords.
    const platformAdmin = await requirePlatformAdmin(req, adminClient, 'super_admin')
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { password, targetAdminId }: Payload = await req.json()
    if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const targetAuthUserId = targetAdminId ?? platformAdmin.authUserId

    const { data: targetAdmin, error: targetError } = await adminClient
      .from('platform_admins')
      .select('id, auth_user_id, email')
      .eq('auth_user_id', targetAuthUserId)
      .eq('is_active', true)
      .single()

    if (targetError || !targetAdmin) {
      return new Response(JSON.stringify({ error: 'Target admin not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const passwordHash = await hashPassword(password, salt)

    const { error: updateError } = await adminClient
      .from('platform_admins')
      .update({
        password_hash: passwordHash,
        failed_challenge_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', targetAuthUserId)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message ?? 'Failed to update password' }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    await adminClient.from('platform_audit_logs').insert({
      actor_id: platformAdmin.authUserId,
      actor_role: platformAdmin.role,
      action: 'platform_admin_password_set',
      target_type: 'platform_admin',
      target_id: targetAuthUserId,
      metadata: {
        target_email: targetAdmin.email,
        self_service: targetAuthUserId === platformAdmin.authUserId,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        target_admin_id: targetAuthUserId,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
