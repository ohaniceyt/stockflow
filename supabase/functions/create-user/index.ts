import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/resend.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'

interface CreateUserPayload {
  name: string
  email: string
  role: 'admin' | 'operator' | 'cashier' | 'reader'
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

function generateTempPin(length = 4): string {
  const digits = '0123456789'
  const randomValues = crypto.getRandomValues(new Uint8Array(length))
  let pin = ''
  for (let i = 0; i < length; i++) {
    pin += digits[randomValues[i] % digits.length]
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing Supabase env vars')
    }

    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claims = await verifyToken(supabaseUrl, anonKey, token)
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

    const operator = await getCurrentMembership(adminClient, operatorId)

    if (!operator || !['super_admin', 'admin'].includes(operator.role)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          debug: 'Operator not found or insufficient role',
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

    // Do not create a duplicate membership in the same org
    const normalizedEmail = email.toLowerCase()
    const { data: existingMembership } = await adminClient
      .from('organization_memberships')
      .select('id')
      .eq('org_id', operator.org_id)
      .eq('users.email', normalizedEmail)
      .maybeSingle()

    if (existingMembership) {
      return new Response(JSON.stringify({ error: 'User already exists in this organization' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tempPin = generateTempPin()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const pinHash = `pbkdf2$${encodeBase64(salt)}$${await hashPin(tempPin, salt)}`

    let authUserId: string | null = null

    // Look for an existing global profile with this email
    const { data: existingProfile } = await adminClient
      .from('users')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile) {
      authUserId = existingProfile.id
    } else {
      const { data: createAuthData, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email: normalizedEmail,
          password: crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { org_id: operator.org_id, role, name },
        })

      if (createAuthError || !createAuthData.user) {
        return new Response(
          JSON.stringify({ error: createAuthError?.message ?? 'Could not create auth user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      authUserId = createAuthData.user.id

      const { error: insertProfileError } = await adminClient.from('users').insert({
        id: authUserId,
        name,
        email: normalizedEmail,
        email_verified: false,
      })

      if (insertProfileError) {
        await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
        return new Response(JSON.stringify({ error: insertProfileError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { error: insertMembershipError } = await adminClient
      .from('organization_memberships')
      .insert({
        org_id: operator.org_id,
        user_id: authUserId,
        role,
        pin_hash: pinHash,
        is_active: true,
        force_pin_change: true,
      })

    if (insertMembershipError) {
      if (!existingProfile && authUserId) {
        await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
        await adminClient
          .from('users')
          .delete()
          .eq('id', authUserId)
          .catch(() => {})
      }
      return new Response(JSON.stringify({ error: insertMembershipError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate a password-recovery link so the new user can set a real password.
    // The account is created with a random password; without this link the user
    // would be unable to sign in (login uses email + password, not the temp PIN).
    const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
    const setupPasswordUrl = `${appUrl}/auth/reset-password`
    let setupLink: string | null = null
    let setupEmailSent = false

    try {
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: {
          redirectTo: setupPasswordUrl,
        },
      })

      if (linkError || !linkData.properties?.action_link) {
        console.error('Failed to generate recovery link:', linkError)
      } else {
        setupLink = linkData.properties.action_link
      }
    } catch (linkErr) {
      console.error('Failed to generate recovery link:', linkErr)
    }

    // Send welcome email with the setup link via Resend.
    // We do not block account creation if the email fails; we just log and surface it.
    let emailSent = false
    try {
      await sendEmail({
        to: email,
        subject: 'Bienvenue sur StockFlow — définissez votre mot de passe',
        html: buildWelcomeEmailHtml(name, setupLink, appUrl),
        text: buildWelcomeEmailText(name, setupLink, appUrl),
      })
      emailSent = true
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr)
    }

    if (setupLink && !emailSent) {
      // Surface the raw setup link to the admin if the email provider is down,
      // so the account is still usable.
      return new Response(
        JSON.stringify({
          success: true,
          tempPin,
          setupLink,
          emailSent: false,
          message:
            'Utilisateur créé (envoi email échoué). Communiquez le lien de configuration ci-dessous.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        tempPin,
        emailSent,
        message: emailSent
          ? 'Utilisateur créé. Un email avec le lien de configuration du mot de passe a été envoyé.'
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

function buildWelcomeEmailHtml(name: string, setupLink: string | null, appUrl: string): string {
  const linkHtml = setupLink
    ? `<p><a class="button" href="${escapeHtml(setupLink)}" target="_blank">Définir mon mot de passe</a></p>`
    : `<p class="text">Un problème est survenu lors de la génération du lien. Contactez votre administrateur pour obtenir un lien de configuration.</p>`

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
          .button { display: inline-block; padding: 14px 24px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; }
          .link { word-break: break-all; color: #6b7280; font-size: 12px; margin-top: 24px; }
          .footer { margin-top: 32px; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">StockFlow</div>
          <div class="title">Bienvenue, ${escapeHtml(name)} !</div>
          <p class="text">
            Votre compte a été créé. Cliquez sur le bouton ci-dessous pour définir votre mot de passe, puis connectez-vous avec votre email et ce mot de passe. Vous devrez ensuite définir un code PIN à votre première connexion.
          </p>
          ${linkHtml}
          ${setupLink ? `<p class="link">Si le bouton ne fonctionne pas : ${escapeHtml(setupLink)}</p>` : ''}
          <p class="footer">
            StockFlow vNext — Ne partagez pas ce lien.
          </p>
        </div>
      </body>
    </html>
  `
}

function buildWelcomeEmailText(name: string, setupLink: string | null, appUrl: string): string {
  const linkText = setupLink
    ? `Définissez votre mot de passe en cliquant sur ce lien : ${setupLink}`
    : `Un problème est survenu lors de la génération du lien. Contactez votre administrateur.`

  return `Bonjour ${name},\n\nVotre compte StockFlow a été créé. ${linkText}\n\nAprès avoir défini votre mot de passe, connectez-vous avec votre email et ce mot de passe. Vous devrez ensuite définir un code PIN à votre première connexion.\n\nStockFlow vNext`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
