import { Search, ScanBarcode, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Product } from '@/types'

interface CatalogProduct extends Product {
  locationId: string
  locationName: string
  available: number
}

interface ProductCatalogProps {
  search: string
  onSearchChange: (value: string) => void
  products: CatalogProduct[]
  onAdd: (product: CatalogProduct) => void
  onStartScanner: () => void
  formatCurrency: (value: number) => string
}

export function ProductCatalog({
  search,
  onSearchChange,
  products,
  onAdd,
  onStartScanner,
  formatCurrency,
}: ProductCatalogProps) {
  return (
    <div className="space-y-4">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher ou scanner…"
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Scanner un code-barre"
          aria-label="Scanner un code-barre"
          onClick={onStartScanner}
        >
          <ScanBarcode className="h-4 w-4" />
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun produit disponible.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              disabled={product.available <= 0}
              onClick={() => onAdd(product)}
              className="flex items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(product.sellingPrice)} / {product.unit} — stock{' '}
                  {product.available}
                </p>
              </div>
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
