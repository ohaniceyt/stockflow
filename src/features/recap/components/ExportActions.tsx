import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import type { StockItem } from '@/features/stock/services/stockService'
import type { MovementWithDetails } from '@/features/movements/services/movementService'
import type { Product } from '@/types'

interface ExportActionsProps {
  products: Product[]
  stock: StockItem[]
  movements: MovementWithDetails[]
  currency: string
}

export function ExportActions({ products, stock, movements }: ExportActionsProps) {
  const productMap = new Map(products.map((p) => [p.id, p]))

  const exportCsv = () => {
    const rows = stock.map((item) => {
      const product = productMap.get(item.productId)
      return {
        Produit: item.productName,
        Emplacement: item.locationName,
        Quantité: item.quantity,
        Unité: item.productUnit,
        Seuil: item.threshold,
        'Valeur achat': item.quantity * (product?.costPrice ?? 0),
        'Valeur vente': item.quantity * (product?.sellingPrice ?? 0),
      }
    })

    if (rows.length === 0) return

    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => String(r[h as keyof typeof r])).join(',')),
    ].join('\n')
    downloadFile(csv, `stock-recap-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
  }

  const exportMovementsCsv = () => {
    const rows = movements.slice(0, 200).map((m) => ({
      Date: m.createdAt,
      Type: m.type,
      Produit: m.productName ?? m.productId,
      Emplacement: m.locationName ?? m.locationId,
      Quantité: m.quantity,
      'Stock avant': m.stockBefore,
      'Stock après': m.stockAfter,
      Opérateur: m.operatorName ?? m.operatorId,
      Motif: m.reason ?? '',
    }))

    if (rows.length === 0) return

    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        headers.map((h) => `"${String(r[h as keyof typeof r]).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')
    downloadFile(csv, `movements-recap-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={exportCsv}>
        <Download className="mr-2 h-4 w-4" />
        Exporter stock CSV
      </Button>
      <Button variant="outline" size="sm" onClick={exportMovementsCsv}>
        <Download className="mr-2 h-4 w-4" />
        Exporter mouvements CSV
      </Button>
    </div>
  )
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
