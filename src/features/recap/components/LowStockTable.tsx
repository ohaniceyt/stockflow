import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { StockItem } from '@/features/stock/services/stockService'

interface LowStockTableProps {
  items: StockItem[]
}

export function LowStockTable({ items }: LowStockTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Aucun stock faible ou en rupture.
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-medium text-muted-foreground">Stocks faibles / ruptures</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produit</TableHead>
            <TableHead>Emplacement</TableHead>
            <TableHead>Quantité</TableHead>
            <TableHead>Seuil</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isOut = item.quantity === 0
            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.productName}</TableCell>
                <TableCell>{item.locationName}</TableCell>
                <TableCell>
                  {item.quantity.toLocaleString()} {item.productUnit}
                </TableCell>
                <TableCell>
                  {item.threshold.toLocaleString()} {item.productUnit}
                </TableCell>
                <TableCell>
                  {isOut ? (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                      Rupture
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                      Faible
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
