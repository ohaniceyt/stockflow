import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { sendEmail } from '../_shared/resend.ts'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { escapeHtml, escapeHtmlAttribute } from '../_shared/html.ts'
import { logActivity } from '../_shared/audit.ts'
import { getLogger, getTraceId } from '../_shared/logger.ts'
import { isEmail, parseJsonBody } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface RequestPinResetPayload {
  email: string
}

const RATE_LIMIT_WINDOW_MINUTES = 15
const MAX_REQUESTS_PER_EMAIL = 3
const MAX_REQUESTS_PER_IP = 10

function buildPinResetEmailHtml(link: string, _appUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Réinitialisation de votre code PIN StockFlow</title>
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
          <div class="title">Réinitialisez votre code PIN</div>
          <p class="text">
            Vous avez demandé la réinitialisation de votre code PIN. Cliquez sur le bouton ci-dessous pour vous connecter en toute sécurité et définir un nouveau PIN.
          </p>
          <p>
            <a class="button" href="${escapeHtmlAttribute(link)}" target="_blank">Réinitialiser mon PIN</a>
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
    const log = getLogger('request-pin-reset')
    log.error('pin_reset_count_failed', { field, value }, error)
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
    const log = getLogger('request-pin-reset')
    log.error('pin_reset_record_failed', { email, ip_address: ipAddress }, error)
  }
}

async function findActiveMembership(
  client: ReturnType<typeof createClient>,
  email: string
): Promise<{ id: string; org_id: string } | null> {
  // NB: the column is `org_id` (not `organization_id`), and we expand the
  // `users` relation with an inner join so the email filter actually applies
  // (filtering on a nested relation without selecting it as !inner silently
  // matches nothing in PostgREST, which previously broke self-service PIN reset).
  const { data, error } = await client
    .from('organization_memberships')
    .select('id, org_id, users!inner(email)')
    .eq('users.email', email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    const log = getLogger('request-pin-reset')
    log.error('pin_reset_membership_lookup_failed', { email }, error)
    return null
  }
  if (!data || typeof data.id !== 'string' || typeof data.org_id !== 'string') return null
  return { id: data.id, org_id: data.org_id }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  const traceId = getTraceId(req)
  const log = getLogger('request-pin-reset', traceId)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return genericInternalErrorResponse(req)
    }

    // This endpoint is no longer public: only an authenticated user may request
    // a PIN reset for their own account.
    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const claims = await verifyToken(supabaseUrl, anonKey, token)
    if (!claims?.sub || !claims.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const parseResult = await parseJsonBody<RequestPinResetPayload>(req)
    if (!parseResult.ok) {
      return parseResult.response
    }

    const { email } = parseResult.body
    const normalizedEmail = email?.trim().toLowerCase()
    if (!isEmail(normalizedEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (normalizedEmail !== claims.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const clientIp = getClientIp(req)

    // Rate-limit by IP to prevent enumeration / abuse.
    const ipRequests = await countRecentRequests(adminClient, 'ip_address', clientIp)
    if (ipRequests >= MAX_REQUESTS_PER_IP) {
      log.warn('pin_reset_rate_limited_ip', { ip_address: clientIp, count: ipRequests })
      return new Response(
        JSON.stringify({ error: 'Too many requests from this network. Try again later.' }),
        { status: 429, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Rate-limit by email.
    const emailRequests = await countRecentRequests(adminClient, 'email', normalizedEmail)
    if (emailRequests >= MAX_REQUESTS_PER_EMAIL) {
      log.warn('pin_reset_rate_limited_email', { email: normalizedEmail, count: emailRequests })
      return new Response(
        JSON.stringify({ error: 'Too many requests for this email. Try again later.' }),
        { status: 429, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Only proceed for active users. We still return a generic success
    // response so we do not leak whether the email exists.
    const membership = await findActiveMembership(adminClient, normalizedEmail)
    if (!membership) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If this email belongs to an active account, a reset link has been sent.',
        }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Mark the membership as requiring a PIN change so the /auth/reset-pin page
    // can set a new PIN without knowing the current one.
    const { error: forceError } = await adminClient
      .from('organization_memberships')
      .update({ force_pin_change: true, updated_at: new Date().toISOString() })
      .eq('id', membership.id)

    if (forceError) {
      log.error('pin_reset_force_flag_failed', { membership_id: membership.id }, forceError)
    }

    const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
    const redirectTo = `${appUrl}/auth/reset-pin`

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: { redirectTo },
    })

    if (linkError || !linkData.properties?.action_link) {
      log.error(
        'pin_reset_link_generation_failed',
        { email: normalizedEmail },
        linkError ?? undefined
      )
      return genericInternalErrorResponse(req)
    }

    const magicLink = linkData.properties.action_link

    const { id } = await sendEmail({
      to: normalizedEmail,
      subject: 'Réinitialisation de votre code PIN StockFlow',
      html: buildPinResetEmailHtml(magicLink, appUrl),
      text: `Vous avez demandé la réinitialisation de votre code PIN. Cliquez sur ce lien pour vous connecter et définir un nouveau PIN : ${magicLink}`,
    })

    await Promise.all([
      recordRequest(adminClient, email, clientIp),
      logActivity(adminClient, {
        org_id: membership.org_id,
        actor_id: claims.sub,
        action: 'pin_reset_requested',
        target_type: 'organization_membership',
        target_id: membership.id,
        details: { email: normalizedEmail, ip_address: clientIp ?? null },
      }),
    ])

    log.info('pin_reset_sent', {
      email: normalizedEmail,
      membership_id: membership.id,
      email_id: id,
    })

    return new Response(JSON.stringify({ success: true, emailId: id }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    const message = _err instanceof Error ? _err.message : 'Unknown error'
    log.error('pin_reset_unhandled_error', {}, _err instanceof Error ? _err : new Error(message))
    return genericInternalErrorResponse(req)
  }
})
