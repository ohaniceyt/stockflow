import { useState } from 'react'
import {
  Download,
  Mail,
  Share2,
  Printer,
  X,
  Send,
  CheckCircle,
  FileCheck,
  Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  useUpdateDocumentStatus,
  useConvertQuoteToInvoice,
  useRecordPayment,
  useMarkDeliveryNoteDelivered,
} from '@/features/invoicing/hooks/useInvoices'
import PrinterSetup from '@/features/invoicing/components/PrinterSetup'
import type {
  InvoiceWithItems,
  QuoteWithItems,
  DeliveryNoteWithItems,
  PaymentMethod,
} from '@/types'

type DocumentWithItems = InvoiceWithItems | QuoteWithItems | DeliveryNoteWithItems

interface DocumentActionsProps {
  doc: DocumentWithItems
  type: 'quote' | 'invoice' | 'delivery_note'
  onClose?: () => void
}

export default function DocumentActions({ doc, type, onClose }: DocumentActionsProps) {
  const { session } = useAuth()
  const updateStatus = useUpdateDocumentStatus()
  const convertQuote = useConvertQuoteToInvoice()
  const recordPayment = useRecordPayment()
  const markDelivered = useMarkDeliveryNoteDelivered()

  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [reminderStatus, setReminderStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )
  const [paymentAmount, setPaymentAmount] = useState(String(doc.total))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showPrinterSetup, setShowPrinterSetup] = useState(false)
  const [showConvertForm, setShowConvertForm] = useState(false)
  const [convertIssueDate, setConvertIssueDate] = useState(
    () => new Date().toISOString().split('T')[0]
  )
  const [convertDueDate, setConvertDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })

  const token = session?.accessToken

  const title = type === 'quote' ? 'Devis' : type === 'invoice' ? 'Facture' : 'Bon de livraison'
  const number = doc.documentNumber
  const totalText = `${doc.total.toLocaleString('fr-FR')} ${doc.currency}`
  const orgName = session?.organization.name ?? 'Flowbill'
  const remaining = Math.max(
    0,
    (doc as InvoiceWithItems).total - (doc as InvoiceWithItems).paidAmount
  )
  const whatsappText = encodeURIComponent(
    `Bonjour,\n\nVeuillez trouver ci-joint votre ${title.toLowerCase()} ${number} de ${orgName}.\nTotal : ${totalText}\n\nMerci pour votre confiance.`
  )

  async function handleDownloadPdf() {
    if (!token) return
    setPdfStatus('loading')
    try {
      const res = await fetch(
        `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/generate-document-pdf`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ document_id: doc.id, type }),
        }
      )
      const data = (await res.json()) as { pdf_base64?: string; filename?: string; error?: string }
      if (!res.ok || !data.pdf_base64) {
        throw new Error(data.error ?? 'Failed to generate PDF')
      }
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${data.pdf_base64}`
      link.download = data.filename ?? `${title.toLowerCase()}-${number}.pdf`
      link.click()
      setPdfStatus('done')
      setTimeout(() => setPdfStatus('idle'), 2000)
    } catch (err) {
      setPdfStatus('error')
      console.error(err)
    }
  }

  async function handleSendEmail() {
    if (!token) return
    setEmailStatus('sending')
    try {
      const res = await fetch(
        `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/send-document-email`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ document_id: doc.id, type }),
        }
      )
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to send email')
      }
      if (type !== 'delivery_note') {
        void updateStatus.mutateAsync({
          id: doc.id,
          status: 'sent',
          sentAt: new Date().toISOString(),
        })
      }
      setEmailStatus('sent')
      setTimeout(() => setEmailStatus('idle'), 3000)
    } catch (err) {
      setEmailStatus('error')
      console.error(err)
    }
  }

  async function handleSendReminder() {
    if (!token || type !== 'invoice') return
    setReminderStatus('sending')
    try {
      const res = await fetch(
        `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/send-invoice-reminder`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoice_id: doc.id }),
        }
      )
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to send reminder')
      }
      setReminderStatus('sent')
      setTimeout(() => setReminderStatus('idle'), 4000)
    } catch (err) {
      setReminderStatus('error')
      console.error(err)
    }
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${whatsappText}`, '_blank')
  }

  function handlePrint() {
    window.print()
  }

  function handleMarkSent() {
    void updateStatus.mutateAsync({ id: doc.id, status: 'sent', sentAt: new Date().toISOString() })
  }

  function handleConvertQuote() {
    if (!showConvertForm) {
      setShowConvertForm(true)
      return
    }
    void convertQuote.mutateAsync({
      quoteId: doc.id,
      options: {
        issueDate: convertIssueDate,
        dueDate: convertDueDate.trim() ? convertDueDate : undefined,
      },
    })
    setShowConvertForm(false)
  }

  function handleRecordPayment(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) return
    void recordPayment.mutateAsync({ invoiceId: doc.id, amount, paymentMethod })
    setShowPaymentForm(false)
  }

  function handleMarkDelivered() {
    void markDelivered.mutateAsync(doc.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {title} {number}
          </h3>
          <p className="text-sm text-muted-foreground">Statut : {doc.status}</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Button onClick={handleDownloadPdf} disabled={pdfStatus === 'loading'} size="sm">
          <Download className="mr-1 h-4 w-4" />
          {pdfStatus === 'loading' ? 'PDF...' : 'PDF'}
        </Button>
        <Button onClick={handleSendEmail} disabled={emailStatus === 'sending'} size="sm">
          <Mail className="mr-1 h-4 w-4" />
          {emailStatus === 'sending' ? 'Envoi...' : emailStatus === 'sent' ? 'Envoyé' : 'E-mail'}
        </Button>
        <Button variant="outline" onClick={handleWhatsApp} size="sm">
          <Share2 className="mr-1 h-4 w-4" /> WhatsApp
        </Button>
        <Button variant="outline" onClick={handlePrint} size="sm">
          <Printer className="mr-1 h-4 w-4" /> Imprimer
        </Button>
        <Button variant="outline" onClick={() => setShowPrinterSetup(true)} size="sm">
          <Printer className="mr-1 h-4 w-4" /> Thermique
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {type === 'quote' && doc.status !== 'converted' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleConvertQuote}
            disabled={convertQuote.isPending}
          >
            <FileCheck className="mr-1 h-4 w-4" />{' '}
            {showConvertForm ? 'Confirmer la conversion' : 'Convertir en facture'}
          </Button>
        )}

        {(type === 'invoice' || type === 'quote') &&
          doc.status !== 'sent' &&
          doc.status !== 'paid' &&
          doc.status !== 'converted' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkSent}
              disabled={updateStatus.isPending}
            >
              <Send className="mr-1 h-4 w-4" /> Marquer envoyé
            </Button>
          )}

        {type === 'invoice' && doc.status !== 'paid' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowPaymentForm((s) => !s)}
            disabled={recordPayment.isPending}
          >
            <CheckCircle className="mr-1 h-4 w-4" /> Enregistrer paiement
          </Button>
        )}

        {type === 'invoice' && doc.status !== 'paid' && doc.status !== 'cancelled' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSendReminder}
            disabled={reminderStatus === 'sending'}
          >
            <Bell className="mr-1 h-4 w-4" />{' '}
            {reminderStatus === 'sending' ? 'Rappel...' : 'Rappeler'}
          </Button>
        )}

        {type === 'delivery_note' && doc.status !== 'delivered' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkDelivered}
            disabled={markDelivered.isPending}
          >
            <CheckCircle className="mr-1 h-4 w-4" /> Marquer livré
          </Button>
        )}
      </div>

      {showConvertForm && type === 'quote' && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-sm font-medium">Conversion du devis en facture</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="convertIssueDate" className="text-xs font-medium">
                Date de facture
              </label>
              <input
                id="convertIssueDate"
                type="date"
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={convertIssueDate}
                onChange={(e) => setConvertIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="convertDueDate" className="text-xs font-medium">
                Date d’échéance
              </label>
              <input
                id="convertDueDate"
                type="date"
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={convertDueDate}
                onChange={(e) => setConvertDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {showPaymentForm && type === 'invoice' && (
        <form onSubmit={handleRecordPayment} className="rounded-md border p-3 space-y-2">
          <p className="text-sm font-medium">
            Reste à payer : {remaining.toLocaleString('fr-FR')} {doc.currency}
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-32 rounded-md border px-2 py-1 text-sm"
            />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="rounded-md border px-2 py-1 text-sm"
            >
              <option value="cash">Espèces</option>
              <option value="card">Carte</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="transfer">Virement</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <Button type="submit" size="sm" disabled={recordPayment.isPending}>
            Valider le paiement
          </Button>
        </form>
      )}

      {pdfStatus === 'error' && (
        <p className="text-sm text-destructive">Erreur lors de la génération du PDF.</p>
      )}
      {emailStatus === 'error' && (
        <p className="text-sm text-destructive">Erreur lors de l’envoi de l’e-mail.</p>
      )}
      {reminderStatus === 'sent' && (
        <p className="text-sm text-green-600">Rappel envoyé avec succès.</p>
      )}
      {reminderStatus === 'error' && (
        <p className="text-sm text-destructive">Erreur lors de l’envoi du rappel.</p>
      )}

      {showPrinterSetup && (
        <PrinterSetup doc={doc} orgName={orgName} onClose={() => setShowPrinterSetup(false)} />
      )}

      <div className="print-only border-t pt-4">
        <div className="space-y-1 text-sm">
          <p className="font-semibold">
            {orgName} — {title} {number}
          </p>
          <p>Date : {new Date(doc.issueDate).toLocaleDateString('fr-FR')}</p>
          <p>Total : {totalText}</p>
          <ul className="mt-2 space-y-1">
            {doc.items.map((item) => (
              <li key={item.id}>
                {item.description} x {item.quantity} @ {item.unitPrice.toLocaleString('fr-FR')}{' '}
                {doc.currency} = {item.total.toLocaleString('fr-FR')} {doc.currency}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-only,
          .print-only * {
            visibility: visible;
          }
          .print-only {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
