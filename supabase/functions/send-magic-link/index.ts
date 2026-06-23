import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { sendEmail } from '../_shared/resend.ts'

interface SendMagicLinkPayload {
  email: string
  redirectTo?: string
}

const RATE_LIMIT_WINDOW_MINUTES = 15
const MAX_REQUESTS_PER_EMAIL = 3
const MAX_REQUESTS_PER_IP = 10

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

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') ?? req.headers.get('cf-connecting-ip') ?? null
}

function rateLimitCutoff(): string {
  return new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
}

async function countRecentRequests(
  client: ReturnType<typeof createClient>,
  field: 'email' | 'ip_address',
  value: string | null
): Promise<number> {
  if (!value) return 0
  const { count, error } = await client
    .from('magic_link_requests')
    .select('*', { count: 'exact', head: true })
    .eq(field, value)
    .gte('created_at', rateLimitCutoff())

  if (error) {
    console.error('Failed to count magic link requests:', error)
    return 0
  }
  return count ?? 0
}

async function recordRequest(
  client: ReturnType<typeof createClient>,
  email: string,
  ipAddress: string | null
): Promise<void> {
  const { error } = await client.from('magic_link_requests').insert({
    email,
    ip_address: ipAddress,
  })
  if (error) {
    console.error('Failed to record magic link request:', error)
  }
}

async function isActiveUser(
  client: ReturnType<typeof createClient>,
  email: string
): Promise<boolean> {
  const { data, error } = await client
    .from('users')
    .select('id')
    .ilike('email', email)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Failed to look up user:', error)
    return false
  }
  return !!data
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

    const clientIp = getClientIp(req)

    // Rate-limit by IP to prevent enumeration / abuse.
    const ipRequests = await countRecentRequests(adminClient, 'ip_address', clientIp)
    if (ipRequests >= MAX_REQUESTS_PER_IP) {
      return new Response(
        JSON.stringify({ error: 'Too many requests from this network. Try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate-limit by email.
    const emailRequests = await countRecentRequests(adminClient, 'email', email)
    if (emailRequests >= MAX_REQUESTS_PER_EMAIL) {
      return new Response(
        JSON.stringify({ error: 'Too many requests for this email. Try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only send magic links to active users. We still return a generic success
    // response so we do not leak whether the email exists.
    const userExists = await isActiveUser(adminClient, email)
    if (!userExists) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If this email belongs to an active account, a magic link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const appUrl = redirectTo ?? Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
    const magicLink = linkData.properties.action_link

    const { id } = await sendEmail({
      to: email,
      subject: 'Votre lien de connexion StockFlow',
      html: buildMagicLinkEmailHtml(magicLink, appUrl),
      text: `Cliquez sur ce lien pour vous connecter à StockFlow : ${magicLink}`,
    })

    await recordRequest(adminClient, email, clientIp)

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
