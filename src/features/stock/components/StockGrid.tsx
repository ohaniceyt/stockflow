import { Package } from 'lucide-react'
import type { StockItem } from '../services/stockService'
import { StockCard } from './StockCard'

interface StockGridProps {
  stock: StockItem[]
  searchQuery?: string
  onItemClick?: (item: StockItem) => void
}

export function StockGrid({ stock, searchQuery = '', onItemClick }: StockGridProps) {
  if (stock.length === 0) {
    return (
      <div className="stock-grid items-center justify-center py-12 text-center text-[var(--text-faint)]">
        <div className="col-span-full flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)]">
            <Package className="h-7 w-7 text-[var(--text-faint)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--text-h)]">Aucun produit</p>
            <p className="text-sm">Créez-en dans l&apos;onglet Produits</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="stock-grid">
      {stock.map((item) => (
        <StockCard
          key={item.id}
          item={item}
          searchQuery={searchQuery}
          onClick={() => onItemClick?.(item)}
        />
      ))}
    </div>
  )
}
