import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { sendEmail } from '../_shared/resend.ts'

interface SendMagicLinkPayload {
  email: string
  redirectTo?: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function buildMagicLinkEmailHtml(link: string, appUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Connexion sécurisée StockFlow</title>
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
          <div class="title">Votre lien de connexion sécurisé</div>
          <p class="text">
            Cliquez sur le bouton ci-dessous pour accéder à votre compte. Ce lien est valable 24 heures et ne peut être utilisé qu'une seule fois.
          </p>
          <p>
            <a class="button" href="${link}" target="_blank">Se connecter</a>
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

    const { email, redirectTo }: SendMagicLinkPayload = await req.json()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo:
          redirectTo ?? Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com',
      },
    })

    if (linkError || !linkData.properties?.action_link) {
      return new Response(
        JSON.stringify({ error: linkError?.message ?? 'Could not generate magic link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const appUrl =
      redirectTo ?? Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
    const magicLink = linkData.properties.action_link

    const { id } = await sendEmail({
      to: email,
      subject: 'Votre lien de connexion StockFlow',
      html: buildMagicLinkEmailHtml(magicLink, appUrl),
      text: `Cliquez sur ce lien pour vous connecter à StockFlow : ${magicLink}`,
    })

    return new Response(JSON.stringify({ success: true, emailId: id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
