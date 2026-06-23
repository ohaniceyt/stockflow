import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Minus, Plus, ArrowLeftRight } from 'lucide-react'
import type { StockItem } from '../services/stockService'

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
  if (stock.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Aucun stock enregistré. Créez des produits et des mouvements pour commencer.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produit</TableHead>
          <TableHead>Emplacement</TableHead>
          <TableHead>Quantité</TableHead>
          <TableHead>Seuil</TableHead>
          <TableHead>Statut</TableHead>
          {canEdit && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {stock.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">
              {item.productName}
              <span className="ml-2 text-xs text-muted-foreground">({item.productUnit})</span>
            </TableCell>
            <TableCell>{item.locationName}</TableCell>
            <TableCell>{item.quantity.toLocaleString()}</TableCell>
            <TableCell>{item.threshold.toLocaleString()}</TableCell>
            <TableCell>{statusBadge(item.quantity, item.threshold)}</TableCell>
            {canEdit && (
              <TableCell className="text-right">
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
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
