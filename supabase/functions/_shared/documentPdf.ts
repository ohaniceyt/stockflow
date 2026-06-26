import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4'

export type DocumentType = 'quote' | 'invoice' | 'delivery_note'

export async function buildDocumentPdfBase64(
  adminClient: SupabaseClient,
  documentId: string,
  type: DocumentType,
): Promise<{ pdfBase64: string; filename: string; document: Record<string, unknown> }> {
  const { data: doc, error: docError } = await adminClient
    .from('invoices')
    .select('*, items:invoice_items(*), org:organizations(*)')
    .eq('id', documentId)
    .eq('type', type)
    .single()

  if (docError || !doc) {
    throw new Error(docError?.message ?? 'Document not found')
  }

  const org = doc.org as Record<string, unknown>
  const items = (doc.items || []) as Array<Record<string, unknown>>

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 40
  let y = height - margin

  const drawText = (
    text: string,
    x: number,
    size = 10,
    opts?: { bold?: boolean; color?: [number, number, number] },
  ) => {
    page.drawText(normalizeSpaces(text), {
      x,
      y,
      size,
      font: opts?.bold ? boldFont : font,
      color: opts?.color ? rgb(opts.color[0], opts.color[1], opts.color[2]) : undefined,
    })
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    })
  }

  drawText(String(org?.name ?? 'StockFlow'), margin, 16, { bold: true })
  y -= 22

  const orgAddress = [org?.address, org?.city, org?.country]
    .filter(Boolean)
    .join(', ')
  if (orgAddress) {
    drawText(orgAddress, margin, 9)
    y -= 12
  }
  if (org?.phone || org?.email) {
    drawText([org?.phone, org?.email].filter(Boolean).join(' · '), margin, 9)
    y -= 12
  }
  if (org?.tax_id) {
    drawText(`${org?.tax_name ?? 'TVA'}: ${org?.tax_id}`, margin, 9)
    y -= 12
  }

  y -= 16
  const title = documentTitle(type)
  drawText(title.toUpperCase(), margin, 18, { bold: true })
  y -= 26

  drawText(`N° ${doc.document_number}`, margin, 11, { bold: true })
  y -= 14
  drawText(`Date: ${new Date(doc.issue_date as string).toLocaleDateString('fr-FR')}`, margin, 10)
  y -= 14
  if (doc.due_date) {
    drawText(`Échéance: ${new Date(doc.due_date as string).toLocaleDateString('fr-FR')}`, margin, 10)
    y -= 14
  }
  if (doc.status) {
    drawText(`Statut: ${formatStatus(String(doc.status))}`, margin, 10)
    y -= 14
  }

  y -= 16
  drawLine(margin, y, width - margin, y)
  y -= 14

  drawText('Article', margin, 10, { bold: true })
  drawText('Qté', width - margin - 160, 10, { bold: true })
  drawText('P.U.', width - margin - 110, 10, { bold: true })
  drawText('Total', width - margin - 50, 10, { bold: true })
  y -= 14

  for (const item of items) {
    const line = String(item.description ?? '')
    const truncated = line.length > 35 ? line.slice(0, 32) + '...' : line
    drawText(truncated, margin, 9)
    drawText(String(item.quantity), width - margin - 160, 9)
    drawText(formatCurrency(Number(item.unit_price), doc.currency as string), width - margin - 110, 9)
    drawText(formatCurrency(Number(item.total), doc.currency as string), width - margin - 50, 9)
    y -= 12
  }

  y -= 10
  drawLine(margin, y, width - margin, y)
  y -= 16

  const totalsX = width - margin - 160
  drawText('Sous-total:', totalsX, 10)
  drawText(formatCurrency(Number(doc.subtotal), doc.currency as string), width - margin - 50, 10)
  y -= 14

  if (Number(doc.tax_total) > 0) {
    drawText(`${org?.tax_name ?? 'Taxe'}:`, totalsX, 10)
    drawText(formatCurrency(Number(doc.tax_total), doc.currency as string), width - margin - 50, 10)
    y -= 14
  }

  drawText('TOTAL:', totalsX, 12, { bold: true })
  drawText(formatCurrency(Number(doc.total), doc.currency as string), width - margin - 50, 12, { bold: true })
  y -= 18

  if (type === 'invoice' && Number(doc.paid_amount) > 0) {
    drawText('Payé:', totalsX, 10)
    drawText(formatCurrency(Number(doc.paid_amount), doc.currency as string), width - margin - 50, 10)
    y -= 14
    drawText('Solde:', totalsX, 10)
    drawText(
      formatCurrency(Math.max(0, Number(doc.total) - Number(doc.paid_amount)), doc.currency as string),
      width - margin - 50,
      10,
    )
    y -= 18
  }

  const legalMentions = org?.legal_mentions as string | null
  if (legalMentions) {
    drawText('Mentions légales:', margin, 9, { bold: true })
    y -= 12
    for (const line of wrapText(legalMentions, 80)) {
      drawText(line, margin, 8)
      y -= 11
    }
  }

  if (y > margin + 40) {
    y = margin + 30
    drawText('Merci pour votre confiance !', margin, 10, { bold: true })
  }

  const pdfBytes = await pdfDoc.save()
  const pdfBase64 = btoa(String.fromCharCode(...pdfBytes))

  return {
    pdfBase64,
    filename: `${filenamePrefix(type)}-${doc.document_number}.pdf`,
    document: doc,
  }
}

function documentTitle(type: DocumentType): string {
  switch (type) {
    case 'quote':
      return 'Devis'
    case 'invoice':
      return 'Facture'
    case 'delivery_note':
      return 'Bon de livraison'
  }
}

function filenamePrefix(type: DocumentType): string {
  switch (type) {
    case 'quote':
      return 'devis'
    case 'invoice':
      return 'facture'
    case 'delivery_note':
      return 'bl'
  }
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    draft: 'Brouillon',
    sent: 'Envoyé',
    paid: 'Payé',
    partial: 'Partiellement payé',
    overdue: 'En retard',
    cancelled: 'Annulé',
    converted: 'Converti',
    accepted: 'Accepté',
    rejected: 'Refusé',
    delivered: 'Livré',
  }
  return map[status] ?? status
}

function formatCurrency(amount: number, currency: string) {
  const formatted = amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${formatted.replace(/[  ]/g, ' ')} ${currency}`
}

function wrapText(text: string, maxLength: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxLength) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function normalizeSpaces(text: string): string {
  return text.replace(/[  ]/g, ' ')
}
