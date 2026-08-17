import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/resend.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody, isEmail, isEnum } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface Payload {
  email: unknown
  role: unknown
}

const ALLOWED_ROLES = ['admin', 'operator', 'cashier', 'reader'] as const

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
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
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const claims = await verifyToken(supabaseUrl, anonKey, token)
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const operator = await getCurrentMembership(adminClient, claims.sub)

    if (!operator || !['super_admin', 'admin'].includes(operator.role)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          debug: 'Operator not found or insufficient role',
        }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) {
      return parsed.response
    }

    const { email, role } = parsed.body
    if (!isEmail(email) || !isEnum(role, ALLOWED_ROLES)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = (email as string).trim().toLowerCase()

    // Do not invite existing membership in same org
    const { data: existingMembership } = await adminClient
      .from('organization_memberships')
      .select('id')
      .eq('org_id', operator.org_id)
      .eq('users.email', normalizedEmail)
      .maybeSingle()

    if (existingMembership) {
      return new Response(JSON.stringify({ error: 'User already exists in this organization' }), {
        status: 409,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: operatorProfile } = await adminClient
      .from('users')
      .select('name')
      .eq('id', operator.user_id)
      .single()

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: invitation, error: insertError } = await adminClient
      .from('invitations')
      .insert({
        org_id: operator.org_id,
        email: normalizedEmail,
        role,
        invited_by: operator.id,
        expires_at: expiresAt,
      })
      .select('id, org_id, email, role, status, token, expires_at, organizations(name)')
      .single()

    if (insertError) {
      console.error('create-invitation insert failed:', insertError)
      return genericInternalErrorResponse(req)
    }

    // Best-effort email notification
    try {
      const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
      const inviteToken = (invitation.token as string | undefined) ?? ''
      const inviteUrl = inviteToken
        ? `${appUrl}/invite?token=${encodeURIComponent(inviteToken)}`
        : `${appUrl}/login`
      await sendEmail({
        to: normalizedEmail,
        subject: 'Invitation à rejoindre une entreprise sur StockFlow',
        html: buildInvitationHtml(
          normalizedEmail,
          (operatorProfile?.name as string | undefined) ?? 'Un administrateur',
          (invitation.organizations as { name: string }).name,
          inviteUrl
        ),
        text: `Bonjour,\n\nVous avez été invité(e) à rejoindre ${(invitation.organizations as { name: string }).name} sur StockFlow.\n\nAcceptez l'invitation ici : ${inviteUrl}\n\nStockFlow vNext`,
      })
    } catch (emailErr) {
      console.error('Failed to send invitation email:', emailErr)
    }

    return new Response(JSON.stringify({ invitation }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})

function buildInvitationHtml(
  email: string,
  inviterName: string,
  orgName: string,
  loginUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invitation StockFlow</title>
      </head>
      <body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:0;">
        <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;padding:32px;">
          <div style="font-size:24px;font-weight:700;margin-bottom:8px;">StockFlow</div>
          <p>Bonjour ${escapeHtml(email)},</p>
          <p>
            <strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre
            l'entreprise <strong>${escapeHtml(orgName)}</strong> sur StockFlow.
          </p>
          <p style="margin-top:24px;">
            <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:14px 24px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;">Se connecter pour accepter</a>
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
