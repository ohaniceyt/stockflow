import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4'

export async function buildReceiptPdfBase64(
  adminClient: SupabaseClient,
  receiptId: string,
): Promise<{ pdfBase64: string; filename: string; receipt: Record<string, unknown> }> {
  const { data: receipt, error: receiptError } = await adminClient
    .from('receipts')
    .select('*, items:receipt_items(*), org:organizations(*)')
    .eq('id', receiptId)
    .single()

  if (receiptError || !receipt) {
    throw new Error(receiptError?.message ?? 'Receipt not found')
  }

  const org = receipt.org as Record<string, unknown>
  const items = (receipt.items || []) as Array<Record<string, unknown>>

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
    page.drawText(text.replace(/[  ]/g, ' '), {
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
  drawText('REÇU', margin, 18, { bold: true })
  y -= 26

  drawText(`N° ${receipt.document_number}`, margin, 11, { bold: true })
  y -= 14
  drawText(`Date: ${new Date(receipt.created_at as string).toLocaleString('fr-FR')}`, margin, 10)
  y -= 14
  drawText(`Paiement: ${formatPaymentMethod(receipt.payment_method as string)}`, margin, 10)
  y -= 14
  if (receipt.notes) {
    drawText(`Note: ${receipt.notes}`, margin, 9)
    y -= 12
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
    const line = String(item.product_name ?? '')
    const truncated = line.length > 35 ? line.slice(0, 32) + '...' : line
    drawText(truncated, margin, 9)
    drawText(String(item.quantity), width - margin - 160, 9)
    drawText(formatCurrency(Number(item.unit_price), receipt.currency as string), width - margin - 110, 9)
    drawText(formatCurrency(Number(item.total), receipt.currency as string), width - margin - 50, 9)
    y -= 12
  }

  y -= 10
  drawLine(margin, y, width - margin, y)
  y -= 16

  const totalsX = width - margin - 160
  drawText('Sous-total:', totalsX, 10)
  drawText(formatCurrency(Number(receipt.subtotal), receipt.currency as string), width - margin - 50, 10)
  y -= 14

  if (Number(receipt.tax_amount) > 0) {
    drawText(`${org?.tax_name ?? 'Taxe'}:`, totalsX, 10)
    drawText(formatCurrency(Number(receipt.tax_amount), receipt.currency as string), width - margin - 50, 10)
    y -= 14
  }

  drawText('TOTAL:', totalsX, 12, { bold: true })
  drawText(formatCurrency(Number(receipt.total), receipt.currency as string), width - margin - 50, 12, { bold: true })
  y -= 18

  drawText('Montant payé:', totalsX, 10)
  drawText(formatCurrency(Number(receipt.amount_paid), receipt.currency as string), width - margin - 50, 10)
  y -= 14
  drawText('Monnaie rendue:', totalsX, 10)
  drawText(formatCurrency(Number(receipt.change_due), receipt.currency as string), width - margin - 50, 10)
  y -= 22

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
    filename: `recu-${receipt.document_number}.pdf`,
    receipt,
  }
}

function formatCurrency(amount: number, currency: string) {
  const formatted = amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  // Replace narrow no-break and non-breaking spaces (not encodable by WinAnsi) with regular spaces.
  return `${formatted.replace(/[  ]/g, ' ')} ${currency}`
}

function formatPaymentMethod(method: string) {
  const map: Record<string, string> = {
    cash: 'Espèces',
    card: 'Carte bancaire',
    mobile_money: 'Mobile Money',
    transfer: 'Virement',
    other: 'Autre',
  }
  return map[method] ?? method
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
