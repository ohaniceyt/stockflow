import { FileSpreadsheet, FileText, RefreshCw, Search, Share2 } from 'lucide-react'

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
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-h)]">Stock</h1>
          <p className="text-sm text-[var(--text-faint)]">
            Visualisation des niveaux de stock par emplacement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn-o btn-sm"
            aria-label="Rafraîchir"
            title="Rafraîchir"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {canExport && (
            <>
              <button
                type="button"
                onClick={onExportPdf}
                className="btn-o btn-sm"
                aria-label="Exporter PDF"
                title="Exporter PDF"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button
                type="button"
                onClick={onExportExcel}
                className="btn-o btn-sm"
                aria-label="Exporter Excel"
                title="Exporter Excel"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Excel</span>
              </button>

              <button
                type="button"
                onClick={onShareWhatsApp}
                className="btn-p btn-sm"
                aria-label="Partager sur WhatsApp"
                title="WhatsApp"
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card flex items-center gap-2 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher par nom, catégorie ou référence…"
          className="w-full bg-transparent text-sm text-[var(--text-h)] placeholder:text-[var(--text-faint)] focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="text-xs text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            Effacer
          </button>
        )}
      </div>

      <div className="card bg-[var(--surface-2)] px-4 py-2 text-center text-sm font-medium text-[var(--text)]">
        {totalProducts.toLocaleString()} produit{totalProducts > 1 ? 's' : ''} en stock
      </div>
    </div>
  )
}
