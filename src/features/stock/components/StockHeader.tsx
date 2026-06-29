import { FileSpreadsheet, FileText, RefreshCw, Search, Share2 } from 'lucide-react'
import { PageHeader } from '@/components/design-system'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface StockHeaderProps {
  totalProducts: number
  searchQuery: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onExportPdf: () => void
  onExportExcel: () => void
  onShareWhatsApp: () => void
  isRefreshing?: boolean
  canExport?: boolean
}

export function StockHeader({
  totalProducts,
  searchQuery,
  onSearchChange,
  onRefresh,
  onExportPdf,
  onExportExcel,
  onShareWhatsApp,
  isRefreshing,
  canExport = false,
}: StockHeaderProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock"
        description="Visualisation des niveaux de stock par emplacement."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Rafraîchir"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {canExport && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onExportPdf}
                  aria-label="Exporter PDF"
                >
                  <FileText className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onExportExcel}
                  aria-label="Exporter Excel"
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Excel</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={onShareWhatsApp}
                  aria-label="Partager sur WhatsApp"
                >
                  <Share2 className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher par nom, catégorie ou référence…"
          className="pl-9 pr-16"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground"
          >
            Effacer
          </button>
        )}
      </div>

      <div className="rounded-xl border bg-muted px-4 py-2 text-center text-sm font-medium text-foreground">
        {totalProducts.toLocaleString()} produit{totalProducts > 1 ? 's' : ''} en stock
      </div>
    </div>
  )
}
