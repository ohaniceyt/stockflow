import { useState } from 'react'
import { Plus, FileText, TrendingUp, AlertCircle, CheckCircle, Clock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  useQuotes,
  useInvoices,
  useDeliveryNotes,
  useCreateQuote,
  useCreateInvoice,
  useCreateDeliveryNote,
} from '@/features/invoicing/hooks/useInvoices'
import { useContacts } from '@/features/contacts/hooks/useContacts'
import { useProducts } from '@/features/products/hooks/useProducts'
import DocumentActions from '@/features/invoicing/components/DocumentActions'
import type {
  InvoiceWithItems,
  QuoteWithItems,
  DeliveryNoteWithItems,
  Contact,
  Product,
} from '@/types'

type DocumentWithItems = InvoiceWithItems | QuoteWithItems | DeliveryNoteWithItems
type TabType = 'quotes' | 'invoices' | 'delivery-notes' | 'overview'

interface DashboardMetrics {
  totalInvoiced: number
  totalPaid: number
  totalOverdue: number
  openQuotes: number
  sentInvoices: number
  deliveredNotes: number
}

function computeMetrics(
  quotes: QuoteWithItems[],
  invoices: InvoiceWithItems[],
  deliveryNotes: DeliveryNoteWithItems[]
): DashboardMetrics {
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0)
  const now = new Date().toISOString().slice(0, 10)
  const totalOverdue = invoices
    .filter(
      (inv) =>
        inv.status !== 'paid' && inv.status !== 'cancelled' && inv.dueDate && inv.dueDate < now
    )
    .reduce((sum, inv) => sum + Math.max(0, inv.total - inv.paidAmount), 0)
  return {
    totalInvoiced,
    totalPaid,
    totalOverdue,
    openQuotes: quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length,
    sentInvoices: invoices.filter(
      (i) => i.status === 'sent' || i.status === 'partial' || i.status === 'overdue'
    ).length,
    deliveredNotes: deliveryNotes.filter((d) => d.status === 'delivered').length,
  }
}

function MetricCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
}: {
  label: string
  value: string
  icon: React.ElementType
  variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const colorClass =
    variant === 'success'
      ? 'text-green-600'
      : variant === 'warning'
        ? 'text-amber-600'
        : variant === 'danger'
          ? 'text-destructive'
          : 'text-primary'
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </div>
      <p className={`mt-1 text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}

function formatCurrency(value: number, currency: string): string {
  return `${value.toLocaleString('fr-FR')} ${currency}`
}

function DocumentList({
  items,
  type,
  onSelect,
}: {
  items: DocumentWithItems[]
  type: TabType
  onSelect: (doc: DocumentWithItems) => void
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="mb-2 h-8 w-8" />
        <p>Aucun document.</p>
      </div>
    )
  }

  const label = type === 'quotes' ? 'Devis' : type === 'invoices' ? 'Factures' : 'Bons de livraison'

  return (
    <div className="space-y-2">
      {items.map((doc) => (
        <button
          type="button"
          key={doc.id}
          onClick={() => onSelect(doc)}
          className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
        >
          <div className="space-y-0.5">
            <p className="font-medium">{doc.documentNumber}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(doc.issueDate).toLocaleDateString('fr-FR')} — {doc.status}
            </p>
          </div>
          <p className="font-semibold">{formatCurrency(doc.total, doc.currency)}</p>
        </button>
      ))}
      <p className="text-sm text-muted-foreground">
        {items.length} {label.toLowerCase()}
      </p>
    </div>
  )
}

interface LineState {
  id: string
  productId?: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discountAmount: number
}

function emptyLine(): LineState {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    unitPrice: 0,
    taxRate: 0,
    discountAmount: 0,
  }
}

function formatDateInput(d: Date): string {
  return d.toISOString().split('T')[0]
}

function computeLineValues(line: LineState) {
  const taxable = Math.max(0, line.quantity * line.unitPrice - line.discountAmount)
  const tax = taxable * (line.taxRate / 100)
  const total = taxable + tax
  return { taxable, tax, total }
}

function CreateForm({
  type,
  onClose,
}: {
  type: 'quote' | 'invoice' | 'delivery_note'
  onClose: () => void
}) {
  const { session } = useAuth()
  const createQuote = useCreateQuote()
  const createInvoice = useCreateInvoice()
  const createDeliveryNote = useCreateDeliveryNote()
  const { data: customers } = useContacts('CUSTOMER')
  const { data: products } = useProducts()

  const orgId = session?.organization.id
  const currency = session?.organization.currency ?? 'XOF'
  const prefix =
    type === 'quote'
      ? (session?.organization.quotePrefix ?? '')
      : type === 'invoice'
        ? (session?.organization.invoicePrefix ?? '')
        : (session?.organization.deliveryNotePrefix ?? '')

  const [contactId, setContactId] = useState('')
  const [issueDate, setIssueDate] = useState(() => formatDateInput(new Date()))
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return formatDateInput(d)
  })
  const [note, setNote] = useState('')
  const [terms, setTerms] = useState('')
  const [lines, setLines] = useState<LineState[]>(() => [emptyLine()])

  const showDueDate = type === 'quote' || type === 'invoice'

  function updateLine(id: string, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function handleProductChange(lineId: string, productId: string) {
    const product = products?.find((p: Product) => p.id === productId)
    if (!product) return
    updateLine(lineId, {
      productId: product.id,
      description: product.name,
      unitPrice: product.sellingPrice,
    })
  }

  const totals = lines.reduce(
    (acc, line) => {
      const { taxable, tax, total } = computeLineValues(line)
      return {
        subtotal: acc.subtotal + taxable,
        taxTotal: acc.taxTotal + tax,
        total: acc.total + total,
      }
    },
    { subtotal: 0, taxTotal: 0, total: 0 }
  )

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!orgId || lines.length === 0) return

    const items = lines.map((l) => ({
      productId: l.productId?.trim() ? l.productId : null,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      discountAmount: l.discountAmount,
    }))

    const base = {
      orgId,
      contactId: contactId.trim() ? contactId : null,
      currency,
      prefix,
      note: note.trim() ? note : null,
      terms: terms.trim() ? terms : null,
      items,
    }

    try {
      if (type === 'quote') {
        await createQuote.mutateAsync({
          ...base,
          issueDate,
          dueDate: showDueDate ? (dueDate.trim() ? dueDate : null) : null,
        })
      } else if (type === 'invoice') {
        await createInvoice.mutateAsync({
          ...base,
          issueDate,
          dueDate: showDueDate ? (dueDate.trim() ? dueDate : null) : null,
        })
      } else {
        await createDeliveryNote.mutateAsync({
          ...base,
          issueDate,
          deliveryAddress: null,
        })
      }
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  const title =
    type === 'quote'
      ? 'Nouveau devis'
      : type === 'invoice'
        ? 'Nouvelle facture'
        : 'Nouveau bon de livraison'
  const pending = createQuote.isPending || createInvoice.isPending || createDeliveryNote.isPending

  return (
    <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto py-4">
      <h4 className="font-medium">{title}</h4>

      <div className="space-y-1">
        <label htmlFor="contact" className="text-sm font-medium">
          Client
        </label>
        <select
          id="contact"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
        >
          <option value="">Sélectionner un client</option>
          {customers?.map((c: Contact) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="issueDate" className="text-sm font-medium">
            Date d’émission
          </label>
          <input
            id="issueDate"
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            required
          />
        </div>
        {showDueDate && (
          <div className="space-y-1">
            <label htmlFor="dueDate" className="text-sm font-medium">
              Date d’échéance
            </label>
            <input
              id="dueDate"
              type="date"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Lignes</p>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter une ligne
          </Button>
        </div>
        {lines.map((line, index) => {
          const { total } = computeLineValues(line)
          return (
            <div key={line.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Ligne {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeLine(line.id)}
                  aria-label="Supprimer la ligne"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="space-y-1">
                <label htmlFor={`product-${line.id}`} className="text-sm font-medium">
                  Produit (optionnel)
                </label>
                <select
                  id={`product-${line.id}`}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={line.productId ?? ''}
                  onChange={(e) => handleProductChange(line.id, e.target.value)}
                >
                  <option value="">Description libre</option>
                  {products?.map((p: Product) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor={`description-${line.id}`} className="text-sm font-medium">
                  Description
                </label>
                <input
                  id={`description-${line.id}`}
                  className="w-full rounded-md border px-2 py-1.5 text-sm"
                  value={line.description}
                  onChange={(e) => updateLine(line.id, { description: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label htmlFor={`qty-${line.id}`} className="text-sm font-medium">
                    Qté
                  </label>
                  <input
                    id={`qty-${line.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`price-${line.id}`} className="text-sm font-medium">
                    P.U.
                  </label>
                  <input
                    id={`price-${line.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`tax-${line.id}`} className="text-sm font-medium">
                    Taxe %
                  </label>
                  <input
                    id={`tax-${line.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    value={line.taxRate}
                    onChange={(e) => updateLine(line.id, { taxRate: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`discount-${line.id}`} className="text-sm font-medium">
                    Remise
                  </label>
                  <input
                    id={`discount-${line.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                    value={line.discountAmount}
                    onChange={(e) =>
                      updateLine(line.id, { discountAmount: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <p className="text-right text-sm font-medium">
                Total ligne : {total.toLocaleString('fr-FR')} {currency}
              </p>
            </div>
          )
        })}
      </div>

      <div className="rounded-md border p-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sous-total</span>
          <span>
            {totals.subtotal.toLocaleString('fr-FR')} {currency}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxes</span>
          <span>
            {totals.taxTotal.toLocaleString('fr-FR')} {currency}
          </span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>
            {totals.total.toLocaleString('fr-FR')} {currency}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1">
          <label htmlFor="note" className="text-sm font-medium">
            Note
          </label>
          <textarea
            id="note"
            rows={2}
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="terms" className="text-sm font-medium">
            Conditions
          </label>
          <textarea
            id="terms"
            rows={2}
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        Créer
      </Button>
    </form>
  )
}

export default function InvoicingPage() {
  const { session } = useAuth()
  const orgId = session?.organization.id ?? ''
  const { data: quotes, isLoading: quotesLoading } = useQuotes(orgId)
  const { data: invoices, isLoading: invoicesLoading } = useInvoices(orgId)
  const { data: deliveryNotes, isLoading: dnLoading } = useDeliveryNotes(orgId)

  const [selectedDoc, setSelectedDoc] = useState<DocumentWithItems | null>(null)
  const [createType, setCreateType] = useState<'quote' | 'invoice' | 'delivery_note' | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const tabs: { value: TabType; label: string; data?: DocumentWithItems[]; loading: boolean }[] = [
    { value: 'overview', label: "Vue d'ensemble", data: undefined, loading: false },
    { value: 'quotes', label: 'Devis', data: quotes, loading: quotesLoading },
    { value: 'invoices', label: 'Factures', data: invoices, loading: invoicesLoading },
    {
      value: 'delivery-notes',
      label: 'Bons de livraison',
      data: deliveryNotes,
      loading: dnLoading,
    },
  ]

  const metrics = computeMetrics(quotes ?? [], invoices ?? [], deliveryNotes ?? [])
  const anyLoading = quotesLoading || invoicesLoading || dnLoading

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Facturation</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCreateType('quote')}>
            <Plus className="mr-1 h-4 w-4" /> Devis
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreateType('invoice')}>
            <Plus className="mr-1 h-4 w-4" /> Facture
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreateType('delivery_note')}>
            <Plus className="mr-1 h-4 w-4" /> BL
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as TabType)}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="flex w-full min-w-[22rem] gap-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex-1 px-2 sm:px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Vue d'ensemble</h2>
            {anyLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <MetricCard
                    label="Total facturé"
                    value={formatCurrency(
                      metrics.totalInvoiced,
                      session?.organization.currency ?? 'XOF'
                    )}
                    icon={TrendingUp}
                  />
                  <MetricCard
                    label="Encaissé"
                    value={formatCurrency(
                      metrics.totalPaid,
                      session?.organization.currency ?? 'XOF'
                    )}
                    icon={CheckCircle}
                    variant="success"
                  />
                  <MetricCard
                    label="Impayé / en retard"
                    value={formatCurrency(
                      metrics.totalOverdue,
                      session?.organization.currency ?? 'XOF'
                    )}
                    icon={AlertCircle}
                    variant="danger"
                  />
                  <MetricCard
                    label="Devis en cours"
                    value={String(metrics.openQuotes)}
                    icon={FileText}
                    variant="warning"
                  />
                  <MetricCard
                    label="Factures à relancer"
                    value={String(metrics.sentInvoices)}
                    icon={Clock}
                    variant="warning"
                  />
                  <MetricCard
                    label="BL livrés"
                    value={String(metrics.deliveredNotes)}
                    icon={CheckCircle}
                    variant="success"
                  />
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {tabs
          .filter((t) => t.value !== 'overview')
          .map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-base font-semibold">{t.label}</h2>
                {t.loading ? (
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                ) : (
                  <DocumentList
                    items={t.data ?? []}
                    type={t.value}
                    onSelect={(doc) => setSelectedDoc(doc)}
                  />
                )}
              </div>
            </TabsContent>
          ))}
      </Tabs>

      <Dialog open={!!selectedDoc} onOpenChange={(open: boolean) => !open && setSelectedDoc(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail du document</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <DocumentActions
              doc={selectedDoc}
              type={
                selectedDoc.type === 'quote'
                  ? 'quote'
                  : selectedDoc.type === 'invoice'
                    ? 'invoice'
                    : 'delivery_note'
              }
              onClose={() => setSelectedDoc(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={createType != null}
        onOpenChange={(open: boolean) => !open && setCreateType(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un document</DialogTitle>
          </DialogHeader>
          {createType && <CreateForm type={createType} onClose={() => setCreateType(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
