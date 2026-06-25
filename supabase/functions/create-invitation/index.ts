import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/resend.ts'
import { getCurrentMembership } from '../_shared/membership.ts'

interface Payload {
  email: string
  role: 'admin' | 'operator' | 'cashier' | 'reader'
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const operator = await getCurrentMembership(adminClient, claims.sub)

    if (!operator || !['super_admin', 'admin'].includes(operator.role)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          debug: 'Operator not found or insufficient role',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, role }: Payload = await req.json()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !role) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Do not invite existing membership in same org
    const { data: existingMembership } = await adminClient
      .from('organization_memberships')
      .select('id')
      .eq('org_id', operator.org_id)
      .eq('users.email', email.toLowerCase())
      .maybeSingle()

    if (existingMembership) {
      return new Response(JSON.stringify({ error: 'User already exists in this organization' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        email: email.toLowerCase(),
        role,
        invited_by: operator.id,
        expires_at: expiresAt,
      })
      .select('id, org_id, email, role, status, token, expires_at, organizations(name)')
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Best-effort email notification
    try {
      const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://stockflow.grandigix.com'
      const token = (invitation.token as string | undefined) ?? ''
      const inviteUrl = token
        ? `${appUrl}/invite?token=${encodeURIComponent(token)}`
        : `${appUrl}/login`
      await sendEmail({
        to: email,
        subject: 'Invitation à rejoindre une organisation sur StockFlow',
        html: buildInvitationHtml(
          email,
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
            l'organisation <strong>${escapeHtml(orgName)}</strong> sur StockFlow.
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
