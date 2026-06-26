import { useState } from 'react'
import { FileText, Mail, MessageCircle, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { edgeFetch } from '@/services/edgeFunctions'
import type { ReceiptWithItems } from '@/types'

interface ReceiptActionsProps {
  receipt: ReceiptWithItems
  orgName: string
  onClose: () => void
}

export default function ReceiptActions({ receipt, orgName, onClose }: ReceiptActionsProps) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const currency = receipt.currency

  const downloadPdf = async () => {
    setStatus('Génération du PDF…')
    try {
      const data = await edgeFetch<{ pdf_base64: string; filename: string }>(
        'generate-receipt-pdf',
        {
          method: 'POST',
          body: JSON.stringify({ receipt_id: receipt.id }),
        }
      )
      if (!data.pdf_base64) {
        throw new Error('PDF generation failed')
      }
      const byteCharacters = atob(data.pdf_base64)
      const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0))
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename || `recu-${receipt.documentNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatus('PDF téléchargé.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erreur PDF')
    }
  }

  const sendEmail = async () => {
    const to = email.trim()
    if (!to) {
      setStatus('Veuillez saisir une adresse email.')
      return
    }
    setSending(true)
    setStatus('Envoi…')
    try {
      await edgeFetch('send-receipt-email', {
        method: 'POST',
        body: JSON.stringify({ receipt_id: receipt.id, to }),
      })
      setStatus('Email envoyé.')
      setEmail('')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erreur email')
    } finally {
      setSending(false)
    }
  }

  const shareWhatsApp = () => {
    const lines = [
      `*${orgName}*`,
      `Reçu ${receipt.documentNumber}`,
      `Date: ${new Date(receipt.createdAt).toLocaleString('fr-FR')}`,
      ``,
      ...receipt.items.map(
        (item) =>
          `${item.productName} x${item.quantity.toString()} = ${formatCurrency(item.total, currency)}`
      ),
      ``,
      `Total: ${formatCurrency(receipt.total, currency)}`,
      `Payé: ${formatCurrency(receipt.amountPaid, currency)} (${formatPaymentMethod(receipt.paymentMethod)})`,
      receipt.changeDue > 0 ? `Monnaie: ${formatCurrency(receipt.changeDue, currency)}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    const url = `https://wa.me/?text=${encodeURIComponent(lines)}`
    window.open(url, '_blank')
  }

  const printReceipt = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Reçu {receipt.documentNumber}</h2>
        <button type="button" onClick={onClose} className="text-muted-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-lg border p-4 text-sm">
        <p className="font-semibold">{orgName}</p>
        <p className="text-muted-foreground">
          {new Date(receipt.createdAt).toLocaleString('fr-FR')}
        </p>
        <div className="mt-2 space-y-1">
          {receipt.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.productName} x{item.quantity}
              </span>
              <span>{formatCurrency(item.total, currency)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t pt-2">
          <div className="flex justify-between">
            <span>Sous-total</span>
            <span>{formatCurrency(receipt.subtotal, currency)}</span>
          </div>
          {receipt.taxAmount > 0 && (
            <div className="flex justify-between">
              <span>Taxe</span>
              <span>{formatCurrency(receipt.taxAmount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatCurrency(receipt.total, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Payé</span>
            <span>{formatCurrency(receipt.amountPaid, currency)}</span>
          </div>
          {receipt.changeDue > 0 && (
            <div className="flex justify-between">
              <span>Monnaie</span>
              <span>{formatCurrency(receipt.changeDue, currency)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={downloadPdf}>
          <FileText className="mr-2 h-4 w-4" />
          PDF
        </Button>
        <Button type="button" variant="outline" onClick={shareWhatsApp}>
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </Button>
        <Button type="button" variant="outline" onClick={printReceipt}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimer
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="receipt-email">
          Envoyer par email
        </label>
        <div className="flex gap-2">
          <input
            id="receipt-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
          />
          <Button type="button" onClick={sendEmail} disabled={sending}>
            <Mail className="mr-2 h-4 w-4" />
            {sending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </div>

      {status && <p className="text-center text-sm text-muted-foreground">{status}</p>}
    </div>
  )
}

function formatCurrency(value: number, currency: string) {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`
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
