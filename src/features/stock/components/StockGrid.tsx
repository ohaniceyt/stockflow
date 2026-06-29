import { Package } from 'lucide-react'
import type { StockItem } from '../services/stockService'
import { StockCard } from './StockCard'
import { EmptyState } from '@/components/design-system'

interface StockGridProps {
  stock: StockItem[]
  searchQuery?: string
  onItemClick?: (item: StockItem) => void
}

export function StockGrid({ stock, searchQuery = '', onItemClick }: StockGridProps) {
  if (stock.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title={searchQuery ? 'Aucun résultat' : 'Aucun produit en stock'}
        description={
          searchQuery
            ? 'Aucun produit ne correspond à votre recherche.'
            : "Créez-en dans l'onglet Produits pour commencer à suivre le stock."
        }
      />
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
