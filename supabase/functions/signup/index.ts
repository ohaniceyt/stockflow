import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { sendEmail } from '../_shared/resend.ts'

interface SignupPayload {
  name: string
  email: string
  password: string
  phone?: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildVerificationEmailHtml(link: string, appUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vérifiez votre compte StockFlow</title>
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
          <div class="title">Confirmez votre adresse email</div>
          <p class="text">
            Cliquez sur le bouton ci-dessous pour activer votre compte. Ce lien est valable 24 heures et ne peut être utilisé qu'une seule fois.
          </p>
          <p>
            <a class="button" href="${link}" target="_blank">Vérifier mon compte</a>
          </p>
          <p class="link">
            Si le bouton ne fonctionne pas, copiez-collez ce lien : <br />${link}
          </p>
          <p class="footer">
            StockFlow vNext — Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
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

    const { name, email, password, phone }: SignupPayload = await req.json()

    if (!name?.trim() || !email?.trim() || !password) {
      return new Response(JSON.stringify({ error: 'Name, email and password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Refuse duplicate accounts
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
    const redirectTo = `${appUrl}/auth/verification`

    let authUserId: string | null = null

    try {
      // Create auth user without confirming email. The confirmation link is sent below.
      const { data: createAuthData, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: false,
          user_metadata: { name: name.trim(), phone: phone ?? null },
        })

      if (createAuthError || !createAuthData.user) {
        throw new Error(createAuthError?.message ?? 'Could not create auth user')
      }
      authUserId = createAuthData.user.id

      const { error: insertUserError } = await adminClient.from('users').insert({
        id: authUserId,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() ?? null,
        email_verified: false,
        active_org_id: null,
      })

      if (insertUserError) {
        throw new Error(insertUserError.message)
      }

      // Generate Supabase email confirmation link and send it through Resend.
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'signup',
        email: normalizedEmail,
        password,
        options: { redirectTo },
      })

      if (linkError || !linkData.properties?.action_link) {
        throw new Error(linkError?.message ?? 'Could not generate verification link')
      }

      await sendEmail({
        to: normalizedEmail,
        subject: 'Confirmez votre compte StockFlow',
        html: buildVerificationEmailHtml(linkData.properties.action_link, appUrl),
        text: `Cliquez sur ce lien pour vérifier votre compte StockFlow : ${linkData.properties.action_link}`,
      })

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Compte créé. Vérifiez votre email pour continuer.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (err) {
      // Best-effort rollback
      if (authUserId) {
        await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
      }

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
