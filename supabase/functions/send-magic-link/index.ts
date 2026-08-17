import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { sendEmail } from '../_shared/resend.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { escapeHtml, escapeHtmlAttribute } from '../_shared/html.ts'
import { getLogger, getTraceId } from '../_shared/logger.ts'
import { parseJsonBody, isEmail } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { isAllowedRedirectUrl, getDefaultRedirectUrl } from '../_shared/redirect.ts'

interface SendMagicLinkPayload {
  email: string
  redirectTo?: string
}

const RATE_LIMIT_WINDOW_MINUTES = 15
const MAX_REQUESTS_PER_EMAIL = 3
const MAX_REQUESTS_PER_IP = 10

export function buildMagicLinkEmailHtml(link: string, _appUrl: string): string {
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
            <a class="button" href="${escapeHtmlAttribute(link)}" target="_blank">Se connecter</a>
          </p>
          <p class="link">
            Si le bouton ne fonctionne pas, copiez-collez ce lien : <br />${escapeHtml(link)}
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
    const log = getLogger('send-magic-link')
    log.error('magic_link_count_failed', { field, value }, error)
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
    const log = getLogger('send-magic-link')
    log.error('magic_link_record_failed', { email, ip_address: ipAddress }, error)
  }
}

async function isActiveUser(
  client: ReturnType<typeof createClient>,
  email: string
): Promise<boolean> {
  const { count, error } = await client
    .from('organization_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('users.email', email.toLowerCase())
    .eq('is_active', true)

  if (error) {
    const log = getLogger('send-magic-link')
    log.error('magic_link_user_lookup_failed', { email }, error)
    return false
  }
  return (count ?? 0) > 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  const traceId = getTraceId(req)
  const log = getLogger('send-magic-link', traceId)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env vars')
    }

    const parsed = await parseJsonBody<SendMagicLinkPayload>(req)
    if (!parsed.ok) return parsed.response

    if (!isEmail(parsed.body.email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (parsed.body.redirectTo !== undefined && !isAllowedRedirectUrl(parsed.body.redirectTo)) {
      log.warn('magic_link_invalid_redirect', { redirect_to: parsed.body.redirectTo })
      return new Response(JSON.stringify({ error: 'Invalid redirect URL' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    const finalRedirectTo = parsed.body.redirectTo ?? getDefaultRedirectUrl()

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const clientIp = getClientIp(req)

    // Rate-limit by IP to prevent enumeration / abuse.
    const ipRequests = await countRecentRequests(adminClient, 'ip_address', clientIp)
    if (ipRequests >= MAX_REQUESTS_PER_IP) {
      log.warn('magic_link_rate_limited_ip', { ip_address: clientIp, count: ipRequests })
      return new Response(
        JSON.stringify({ error: 'Too many requests from this network. Try again later.' }),
        { status: 429, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Rate-limit by email.
    const emailRequests = await countRecentRequests(adminClient, 'email', parsed.body.email)
    if (emailRequests >= MAX_REQUESTS_PER_EMAIL) {
      log.warn('magic_link_rate_limited_email', { email: parsed.body.email, count: emailRequests })
      return new Response(
        JSON.stringify({ error: 'Too many requests for this email. Try again later.' }),
        { status: 429, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Only send magic links to active users. We still return a generic success
    // response so we do not leak whether the email exists.
    const userExists = await isActiveUser(adminClient, parsed.body.email)
    if (!userExists) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If this email belongs to an active account, a magic link has been sent.',
        }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: parsed.body.email,
      options: {
        redirectTo: finalRedirectTo,
      },
    })

    if (linkError || !linkData.properties?.action_link) {
      log.error(
        'magic_link_generation_failed',
        { email: parsed.body.email },
        linkError ?? undefined
      )
      return genericInternalErrorResponse(req)
    }

    const appUrl = finalRedirectTo
    const magicLink = linkData.properties.action_link

    const { id } = await sendEmail({
      to: parsed.body.email,
      subject: 'Votre lien de connexion StockFlow',
      html: buildMagicLinkEmailHtml(magicLink, appUrl),
      text: `Cliquez sur ce lien pour vous connecter à StockFlow : ${magicLink}`,
    })

    await recordRequest(adminClient, parsed.body.email, clientIp)

    log.info('magic_link_sent', { email: parsed.body.email, ip_address: clientIp, email_id: id })

    return new Response(JSON.stringify({ success: true, emailId: id }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    const message = _err instanceof Error ? _err.message : 'Unknown error'
    log.error('magic_link_unhandled_error', {}, _err instanceof Error ? _err : new Error(message))
    return genericInternalErrorResponse(req)
  }
})
