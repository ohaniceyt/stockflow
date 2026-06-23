import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { sendEmail } from '../_shared/resend.ts'

interface SignupPayload {
  orgName: string
  name: string
  email: string
  planId: 'free' | 'starter' | 'pro' | 'enterprise'
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TRIAL_DAYS = 14

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildWelcomeEmailHtml(
  name: string,
  orgName: string,
  tempPin: string,
  loginUrl: string
): string {
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
            Votre organisation <strong>${escapeHtml(orgName)}</strong> a été créée. Utilisez le PIN temporaire ci-dessous pour vous connecter. Vous devrez le changer lors de votre première connexion.
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

    const { orgName, name, email, planId }: SignupPayload = await req.json()
    if (!orgName?.trim() || !name?.trim() || !email?.trim() || !planId) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Ensure plan exists
    const { data: plan, error: planError } = await adminClient
      .from('plans')
      .select('id, price_monthly')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Ensure email is not already used
    const { data: existingUser, error: existingError } = await adminClient
      .from('users')
      .select('id')
      .ilike('email', email.trim())
      .maybeSingle()

    if (existingError) {
      return new Response(JSON.stringify({ error: existingError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const tempPin = generateTempPin()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const pinHash = `pbkdf2$${encodeBase64(salt)}$${await hashPin(tempPin, salt)}`

    // Create organization
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .insert({
        name: orgName.trim(),
        currency: 'XOF',
        timezone: 'Africa/Abidjan',
        onboarding_completed: true,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: orgError?.message ?? 'Could not create organization' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    let authUserId: string | null = null

    try {
      // Create auth user
      const { data: createAuthData, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email: normalizedEmail,
          password: crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { org_id: org.id, role: 'admin', name: name.trim() },
        })

      if (createAuthError || !createAuthData.user) {
        throw new Error(createAuthError?.message ?? 'Could not create auth user')
      }

      authUserId = createAuthData.user.id

      // Insert internal user row
      const { error: insertUserError } = await adminClient.from('users').insert({
        id: authUserId,
        org_id: org.id,
        name: name.trim(),
        email: normalizedEmail,
        email_verified: false,
        role: 'admin',
        pin_hash: pinHash,
        is_active: true,
        force_pin_change: true,
      })

      if (insertUserError) {
        throw new Error(insertUserError.message)
      }

      // Create default location
      const { error: locationError } = await adminClient.from('locations').insert({
        org_id: org.id,
        name: 'Dépôt principal',
        description: 'Emplacement par défaut créé lors de l’inscription',
        is_default: true,
      })

      if (locationError) {
        throw new Error(locationError.message)
      }

      // Create subscription
      const isFree = plan.price_monthly === 0
      const { error: subError } = await adminClient.from('subscriptions').insert({
        org_id: org.id,
        plan_id: planId,
        status: isFree ? 'active' : 'trialing',
        billing_interval: 'month',
        current_period_starts_at: new Date().toISOString(),
        current_period_ends_at: isFree
          ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        trial_ends_at: isFree
          ? null
          : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      })

      if (subError) {
        throw new Error(subError.message)
      }

      // Send welcome email
      let emailSent = false
      try {
        const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
        await sendEmail({
          to: normalizedEmail,
          subject: 'Bienvenue sur StockFlow — vos identifiants temporaires',
          html: buildWelcomeEmailHtml(name.trim(), orgName.trim(), tempPin, `${appUrl}/login`),
          text: `Bonjour ${name.trim()},\n\nVotre organisation ${orgName.trim()} a été créée sur StockFlow.\n\nVotre PIN temporaire est : ${tempPin}\n\nPour vous connecter : ${appUrl}/login\n\nVous devrez définir un PIN définitif lors de votre première connexion.\n\nStockFlow vNext`,
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
            ? 'Compte créé. Un email avec le PIN temporaire a été envoyé.'
            : 'Compte créé. Communiquez le PIN temporaire (envoi email échoué).',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (err) {
      // Best-effort rollback
      if (authUserId) {
        await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
      }
      await adminClient
        .from('organizations')
        .delete()
        .eq('id', org.id)
        .catch(() => {})

      const message = err instanceof Error ? err.message : 'Unknown error'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
