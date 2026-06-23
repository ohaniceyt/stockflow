import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Minus, Plus, ArrowLeftRight } from 'lucide-react'
import type { StockItem } from '../services/stockService'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

interface StockListProps {
  stock: StockItem[]
  canEdit: boolean
  onQuickMove: (item: StockItem, type: 'IN' | 'OUT' | 'TRANSFER') => void
  isUpdating?: boolean
}

function statusBadge(quantity: number, threshold: number) {
  if (quantity === 0) return <Badge variant="destructive">Rupture</Badge>
  if (quantity <= threshold) return <Badge variant="secondary">Bas</Badge>
  return <Badge variant="default">OK</Badge>
}

export function StockList({ stock, canEdit, onQuickMove, isUpdating }: StockListProps) {
  const columns: ResponsiveColumn<StockItem>[] = [
    {
      key: 'product',
      header: 'Produit',
      cell: (item) => (
        <>
          {item.productName}
          <span className="ml-2 text-xs text-muted-foreground">({item.productUnit})</span>
        </>
      ),
      className: 'font-medium',
    },
    { key: 'location', header: 'Emplacement', cell: (item) => item.locationName },
    {
      key: 'quantity',
      header: 'Quantité',
      cell: (item) => item.quantity.toLocaleString(),
    },
    {
      key: 'threshold',
      header: 'Seuil',
      cell: (item) => item.threshold.toLocaleString(),
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (item) => statusBadge(item.quantity, item.threshold),
    },
    ...(canEdit
      ? [
          {
            key: 'actions' as const,
            header: 'Actions',
            className: 'text-right' as const,
            cell: (item: StockItem) => (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onQuickMove(item, 'OUT')}
                  disabled={item.quantity <= 0 || Boolean(isUpdating)}
                  aria-label={`Retirer ${item.productName}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onQuickMove(item, 'IN')}
                  disabled={isUpdating}
                  aria-label={`Ajouter ${item.productName}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onQuickMove(item, 'TRANSFER')}
                  disabled={item.quantity <= 0 || Boolean(isUpdating)}
                  aria-label={`Transférer ${item.productName}`}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  const empty = (
    <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
      Aucun stock enregistré. Créez des produits et des mouvements pour commencer.
    </div>
  )

  return (
    <ResponsiveTable
      data={stock}
      columns={columns}
      keyExtractor={(item) => item.id}
      empty={empty}
      mobileCardTitle={(item) => item.productName}
    />
  )
}
