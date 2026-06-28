import { useState } from 'react'
import { jsPDF } from 'jspdf'
import { Button } from '@/components/ui/button'
import { Download, FileText, Share2, AlertCircle } from 'lucide-react'
import type { Product } from '@/types'
import type { StockItem } from '@/features/stock/services/stockService'
import type { MovementWithDetails } from '@/features/movements/services/movementService'

interface ExportActionsProps {
  periodLabel: string
  movements: MovementWithDetails[]
  stock: StockItem[]
  products: Product[]
  productMap: Map<string, Product>
  currency: string
  orgName?: string
  redactFinancials?: boolean
}

export function ExportActions({
  periodLabel,
  movements,
  stock,
  products,
  productMap,
  currency,
  orgName = 'StockFlow',
  redactFinancials = false,
}: ExportActionsProps) {
  const [loading, setLoading] = useState<'excel' | 'pdf' | 'whatsapp' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wrapAsync = async (key: 'excel' | 'pdf' | 'whatsapp', fn: () => void | Promise<void>) => {
    setError(null)
    setLoading(key)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'export")
    } finally {
      setLoading(null)
    }
  }

  const exportToExcel = () => {
    return wrapAsync('excel', async () => {
      const { Workbook } = await import('exceljs')
      const wb = new Workbook()
      const movementsSheet = wb.addWorksheet('Mouvements')
      const balanceSheet = wb.addWorksheet('Solde par produit')

      movementsSheet.columns = [
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Type', key: 'type', width: 14 },
        { header: 'Produit', key: 'product', width: 28 },
        { header: 'Emplacement', key: 'location', width: 20 },
        { header: 'Quantité', key: 'quantity', width: 12 },
        { header: 'Stock avant', key: 'stockBefore', width: 12 },
        { header: 'Stock après', key: 'stockAfter', width: 12 },
        { header: 'Opérateur', key: 'operator', width: 20 },
        { header: 'Motif', key: 'reason', width: 24 },
        { header: 'Contact', key: 'contact', width: 20 },
      ]

      movementsSheet.addRow({
        date: `Période: ${periodLabel}`,
      })

      const sortedMovements = [...movements].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      sortedMovements.forEach((m) => {
        const typeLabels: Record<string, string> = {
          IN: 'Entrée',
          OUT: 'Sortie',
          INVENTORY: 'Inventaire',
          ADJUSTMENT: 'Ajustement',
          TRANSFER: 'Transfert',
        }
        movementsSheet.addRow({
          date: new Date(m.createdAt).toLocaleString('fr-FR'),
          type: typeLabels[m.type] ?? m.type,
          product: m.productName ?? m.productId,
          location: m.locationName ?? m.locationId,
          quantity: m.quantity,
          stockBefore: m.stockBefore,
          stockAfter: m.stockAfter,
          operator: m.operatorName ?? m.operatorId,
          reason: m.reason ?? '',
          contact: m.contactName ?? '',
        })
      })

      balanceSheet.columns = [
        { header: 'Produit', key: 'product', width: 28 },
        { header: 'Unité', key: 'unit', width: 12 },
        { header: 'Entrées', key: 'in', width: 12 },
        { header: 'Sorties', key: 'out', width: 12 },
        { header: 'Solde', key: 'balance', width: 12 },
        ...(redactFinancials
          ? []
          : [
              { header: 'Valeur stock achat', key: 'stockValue', width: 18 },
              { header: 'Valeur stock vente', key: 'sellingValue', width: 18 },
            ]),
      ]

      products.forEach((p) => {
        const productMovements = movements.filter((m) => m.productId === p.id)
        const inQty = productMovements
          .filter((m) => m.type === 'IN')
          .reduce((sum, m) => sum + m.quantity, 0)
        const outQty = productMovements
          .filter((m) => m.type === 'OUT')
          .reduce((sum, m) => sum + m.quantity, 0)
        const stockItem = stock.find((s) => s.productId === p.id)
        const quantity = stockItem?.quantity ?? 0
        balanceSheet.addRow({
          product: p.name,
          unit: p.unit,
          in: inQty,
          out: outQty,
          balance: inQty - outQty,
          ...(redactFinancials
            ? {}
            : {
                stockValue: quantity * p.costPrice,
                sellingValue: quantity * p.sellingPrice,
              }),
        })
      })
      ;[movementsSheet, balanceSheet].forEach((sheet) => {
        const headerRow = sheet.getRow(2)
        headerRow.font = { bold: true }
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        }
      })

      const buffer = await wb.xlsx.writeBuffer()
      downloadBlob(
        buffer,
        `analytics-${orgName}-${periodLabel.replace(/\s+/g, '_')}-${today()}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })
  }

  const exportToPdf = () => {
    return wrapAsync('pdf', () => {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 14

      doc.setFontSize(16)
      doc.text(`Analytics - ${orgName}`, 14, y)
      y += 8
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Période: ${periodLabel} — Généré le ${new Date().toLocaleString('fr-FR')}`, 14, y)
      y += 12

      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text('Mouvements', 14, y)
      y += 6

      if (movements.length === 0) {
        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text('Aucun mouvement dans la période.', 14, y)
      } else {
        const sortedMovements = [...movements].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        sortedMovements.forEach((m) => {
          if (y > 270) {
            doc.addPage()
            y = 14
          }
          const typeLabels: Record<string, string> = {
            IN: 'Entrée',
            OUT: 'Sortie',
            INVENTORY: 'Inventaire',
            ADJUSTMENT: 'Ajustement',
            TRANSFER: 'Transfert',
          }
          const date = new Date(m.createdAt).toLocaleString('fr-FR')
          const label = `${typeLabels[m.type] ?? m.type} — ${m.productName ?? m.productId}`
          doc.setFontSize(10)
          doc.setTextColor(15, 23, 42)
          doc.text(label, 14, y)
          doc.setFontSize(9)
          doc.setTextColor(100)
          doc.text(`${m.quantity.toLocaleString()} unité(s) · ${date}`, pageWidth - 14, y, {
            align: 'right',
          })
          y += 6
          doc.setDrawColor(226, 232, 240)
          doc.line(14, y, pageWidth - 14, y)
          y += 4
        })
      }

      doc.save(`analytics-${orgName}-${periodLabel.replace(/\s+/g, '_')}-${today()}.pdf`)
    })
  }

  const shareWhatsApp = () => {
    return wrapAsync('whatsapp', () => {
      const typeLabels: Record<string, string> = {
        IN: 'Entrée',
        OUT: 'Sortie',
        INVENTORY: 'Inventaire',
        ADJUSTMENT: 'Ajustement',
        TRANSFER: 'Transfert',
      }

      const lines = movements.slice(0, 30).map((m) => {
        const date = new Date(m.createdAt).toLocaleDateString('fr-FR')
        return `• ${typeLabels[m.type] ?? m.type} — ${m.productName ?? m.productId}: ${m.quantity.toLocaleString()} (${date})`
      })

      let footer = ''
      if (!redactFinancials) {
        const revenue = movements
          .filter((m) => m.type === 'OUT')
          .reduce((sum, m) => {
            const product = productMap.get(m.productId)
            return sum + m.quantity * (product?.sellingPrice ?? 0)
          }, 0)
        footer = `\n\nCA période: ${revenue.toLocaleString()} ${currency}`
      }

      const header = `*Analytics ${orgName} — ${periodLabel}*\n\n`
      const body = lines.length > 0 ? lines.join('\n') : 'Aucun mouvement dans la période.'
      const message = header + body + footer

      const url = `https://wa.me/?text=${encodeURIComponent(message)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportToExcel} disabled={loading !== null}>
          <Download className="mr-2 h-4 w-4" />
          {loading === 'excel' ? 'Export…' : 'Excel'}
        </Button>
        <Button variant="outline" size="sm" onClick={exportToPdf} disabled={loading !== null}>
          <FileText className="mr-2 h-4 w-4" />
          {loading === 'pdf' ? 'Export…' : 'PDF'}
        </Button>
        <Button variant="outline" size="sm" onClick={shareWhatsApp} disabled={loading !== null}>
          <Share2 className="mr-2 h-4 w-4" />
          {loading === 'whatsapp' ? 'Ouverture…' : 'WhatsApp'}
        </Button>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}

function downloadBlob(buffer: ArrayBuffer | BlobPart, filename: string, type: string) {
  const blob = new Blob([buffer], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
