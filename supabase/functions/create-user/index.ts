import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/resend.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'

interface CreateUserPayload {
  name: string
  email: string
  role: 'admin' | 'operator' | 'reader'
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return encodeBase64(new Uint8Array(derived))
}

function generateTempPin(): string {
  const digits = '0123456789'
  let pin = ''
  for (let i = 0; i < 4; i++) {
    pin += digits[Math.floor(Math.random() * digits.length)]
  }
  return pin
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env vars')
    }

    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claims = parseJwt(token)
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const operatorId = claims.sub

    const { data: operator, error: operatorError } = await adminClient
      .from('users')
      .select('role, org_id')
      .eq('id', operatorId)
      .single()

    if (operatorError || !operator || !['super_admin', 'admin'].includes(operator.role)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          debug: operatorError?.message ?? 'Operator not found or insufficient role',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { name, email, role }: CreateUserPayload = await req.json()
    if (!name || !email || !role || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (operator.role === 'admin' && role === 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Quota check
    const limits = await getOrgLimits(adminClient, operator.org_id)
    if (!limits) {
      return new Response(JSON.stringify({ error: 'Could not load organization limits' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (isAtLimit(limits.usedUsers, limits.maxUsers)) {
      return new Response(JSON.stringify({ error: 'User limit reached for this plan' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tempPin = generateTempPin()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const pinHash = `pbkdf2$${encodeBase64(salt)}$${await hashPin(tempPin, salt)}`

    const { data: createAuthData, error: createAuthError } =
      await adminClient.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        // We manage email verification ourselves (welcome + magic-link emails via Resend),
        // so confirm the email immediately to avoid Supabase sending its own confirmation email.
        email_confirm: true,
        user_metadata: { org_id: operator.org_id, role, name },
      })

    if (createAuthError || !createAuthData.user) {
      return new Response(
        JSON.stringify({ error: createAuthError?.message ?? 'Could not create auth user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: insertError } = await adminClient.from('users').insert({
      id: createAuthData.user.id,
      org_id: operator.org_id,
      name,
      email,
      email_verified: false,
      role,
      pin_hash: pinHash,
      is_active: true,
      force_pin_change: true,
    })

    if (insertError) {
      // Best-effort cleanup of auth user
      await adminClient.auth.admin.deleteUser(createAuthData.user.id)
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send welcome email with temporary PIN via Resend.
    // We do not block account creation if the email fails; we just log and surface it.
    let emailSent = false
    try {
      const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
      const loginUrl = `${appUrl}/login`
      await sendEmail({
        to: email,
        subject: 'Bienvenue sur StockFlow — vos identifiants temporaires',
        html: buildWelcomeEmailHtml(name, tempPin, loginUrl),
        text: `Bonjour ${name},\n\nVotre compte StockFlow a été créé.\n\nVotre PIN temporaire est : ${tempPin}\n\nPour vous connecter : ${loginUrl}\n\nVous devrez définir un PIN définitif lors de votre première connexion.\n\nStockFlow vNext`,
      })
      emailSent = true
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        tempPin,
        emailSent,
        message: emailSent
          ? 'Utilisateur créé. Un email avec le PIN temporaire a été envoyé.'
          : 'Utilisateur créé. Communiquez le PIN temporaire (envoi email échoué).',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function buildWelcomeEmailHtml(name: string, tempPin: string, loginUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Bienvenue sur StockFlow</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .logo { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 8px; }
          .title { font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 16px; }
          .text { color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
          .pin-box { background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px; }
          .pin { font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #111827; }
          .button { display: inline-block; padding: 14px 24px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; }
          .footer { margin-top: 32px; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">StockFlow</div>
          <div class="title">Bienvenue, ${escapeHtml(name)} !</div>
          <p class="text">
            Votre compte a été créé. Utilisez le PIN temporaire ci-dessous pour vous connecter. Vous devrez le changer lors de votre première connexion.
          </p>
          <div class="pin-box">
            <div class="pin">${escapeHtml(tempPin)}</div>
          </div>
          <p>
            <a class="button" href="${escapeHtml(loginUrl)}" target="_blank">Se connecter</a>
          </p>
          <p class="footer">
            StockFlow vNext — Ne partagez ce PIN avec personne.
          </p>
        </div>
      </body>
    </html>
  `
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
