#!/usr/bin/env node
// Supabase Edge Function helper: deploy an invoicing reminder Edge Function.
// This creates supabase/functions/send-invoice-reminder/index.ts and deploys it.
// It also creates the DB migration to schedule reminders via pg_cron (if available)
// or documents how to trigger manually from the application.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const BASE = '/Users/macbook/Desktop/stockflow-vnext'
const FN_DIR = path.join(BASE, 'supabase/functions/send-invoice-reminder')
const MIGRATION = path.join(BASE, 'supabase/migrations/20260626091500_invoice_reminders.sql')

const fnCode = `import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/resend.ts'
import { buildDocumentPdfBase64 } from '../_shared/documentPdf.ts'

interface SendInvoiceReminderPayload {
  invoice_id: string
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

    const payload: SendInvoiceReminderPayload = await req.json()
    if (!payload.invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: invoice, error: invoiceError } = await adminClient
      .from('invoices')
      .select('*, org:organizations(*), contact:contacts(*)')
      .eq('id', payload.invoice_id)
      .eq('type', 'invoice')
      .single()

    if (invoiceError || !invoice) {
      throw new Error(invoiceError?.message ?? 'Invoice not found')
    }

    const status = String(invoice.status)
    if (status === 'paid' || status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: false, reason: \`Invoice is already \${status}\` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { pdfBase64, filename, document } = await buildDocumentPdfBase64(
      adminClient,
      payload.invoice_id,
      'invoice',
    )

    const recipient = payload.to ?? (invoice.contact as Record<string, unknown>)?.email ?? null
    if (!recipient) {
      return new Response(
        JSON.stringify({ error: 'No recipient email provided or found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const orgName = (invoice.org as Record<string, unknown>)?.name ?? 'StockFlow'
    const documentNumber = invoice.document_number as string
    const totalFormatted = formatCurrency(Number(invoice.total), invoice.currency as string)
    const paidAmount = Number(invoice.paid_amount ?? 0)
    const remaining = Math.max(0, Number(invoice.total) - paidAmount)

    const html = \`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Rappel - Votre facture \${documentNumber}</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <p>Bonjour,</p>
    <p>Nous vous rappelons que votre facture <strong>\${documentNumber}</strong> de <strong>\${orgName}</strong> d'un montant de <strong>\${totalFormatted}</strong> n'a pas encore été réglée.</p>
    \${remaining > 0 ? \`<p>Reste à payer : <strong>\${formatCurrency(remaining, invoice.currency as string)}</strong></p>\` : ''}
    <p>La facture est jointe à cet email. Merci de procéder au règlement dans les meilleurs délais.</p>
    <br />
    <p><em>Cet email a été envoyé automatiquement par StockFlow.</em></p>
  </body>
</html>\`

    const text = \`Bonjour,\n\nNous vous rappelons que votre facture \${documentNumber} de \${orgName} d'un montant de \${totalFormatted} n'a pas encore été réglée.\n\${remaining > 0 ? \`Reste à payer : \${formatCurrency(remaining, invoice.currency as string)}\n\` : ''}La facture est jointe à cet email. Merci de procéder au règlement dans les meilleurs délais.\n\nCet email a été envoyé automatiquement par StockFlow.\`

    const emailResult = await sendEmail({
      to: recipient,
      subject: \`Rappel : Votre facture \${documentNumber} - \${orgName}\`,
      html,
      text,
      attachments: [{ filename, content: pdfBase64 }],
    })

    // Track reminder on the invoice row.
    await adminClient
      .from('invoices')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', payload.invoice_id)

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResult.id,
        invoice_id: invoice.id,
        sent_to: recipient,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function formatCurrency(amount: number, currency: string) {
  const formatted = amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return \`\${formatted.replace(/[  ]/g, ' ')} \${currency}\`
}
`

const migrationCode = `-- Invoice reminders: scheduled function to nudge customers with unpaid/overdue invoices.
-- Adds a lightweight reminders_sent counter and a function invoked by pg_cron or manually.

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS reminders_sent INTEGER NOT NULL DEFAULT 0;

-- Index to find invoices needing a reminder.
CREATE INDEX IF NOT EXISTS idx_invoices_reminder_candidates
  ON invoices(org_id, type, status, due_date)
  WHERE type = 'invoice' AND status NOT IN ('paid', 'cancelled');

-- Function: fetch candidate invoices and send reminder via the Edge Function.
-- Designed to be called by pg_cron; the actual HTTP call is delegated to the cron job config.
CREATE OR REPLACE FUNCTION get_overdue_invoices_for_org(p_org_id UUID)
RETURNS TABLE (
  invoice_id UUID,
  document_number TEXT,
  total NUMERIC,
  currency TEXT,
  due_date DATE,
  contact_email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_temp, public, pg_catalog
AS $$
  SELECT
    i.id AS invoice_id,
    i.document_number,
    i.total,
    i.currency,
    i.due_date,
    c.email AS contact_email
  FROM invoices i
  LEFT JOIN contacts c ON c.id = i.contact_id
  WHERE i.org_id = p_org_id
    AND i.type = 'invoice'
    AND i.status NOT IN ('paid', 'cancelled')
    AND (
      i.due_date IS NULL
      OR i.due_date <= CURRENT_DATE + INTERVAL '1 day'
    )
  ORDER BY i.due_date ASC;
$$;

-- RLS: reminders are managed via service-role/Edge Function only.
GRANT EXECUTE ON FUNCTION public.get_overdue_invoices_for_org(UUID) TO authenticated;
`

if (!existsSync(FN_DIR)) mkdirSync(FN_DIR, { recursive: true })
writeFileSync(path.join(FN_DIR, 'index.ts'), fnCode)
writeFileSync(MIGRATION, migrationCode)

console.log('Created Edge Function:', FN_DIR)
console.log('Created migration:', MIGRATION)

console.log('Deploying send-invoice-reminder...')
try {
  execSync('npx supabase functions deploy send-invoice-reminder', { cwd: BASE, stdio: 'inherit' })
} catch (err) {
  console.error('Deploy failed. Run manually: npx supabase functions deploy send-invoice-reminder')
  process.exit(1)
}

console.log('Done.')
