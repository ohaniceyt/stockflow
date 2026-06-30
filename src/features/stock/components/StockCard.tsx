import { useAuth } from '@/features/auth/context/AuthContext'
import type { StockItem } from '../services/stockService'
import { StatusBadge } from '@/components/design-system'

interface StockCardProps {
  item: StockItem
  searchQuery?: string
  onClick: () => void
}

function statusInfo(quantity: number, threshold: number) {
  if (quantity <= 0) {
    return { label: 'RUPTURE', variant: 'danger' as const }
  }
  if (quantity <= threshold) {
    return { label: 'ALERTE', variant: 'warning' as const }
  }
  return { label: 'OK', variant: 'success' as const }
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text
  const lowerQuery = query.toLowerCase()
  const lowerText = text.toLowerCase()
  const result: React.ReactNode[] = []
  let lastIndex = 0
  let index = lowerText.indexOf(lowerQuery)
  let key = 0
  while (index !== -1) {
    if (index > lastIndex) {
      result.push(<span key={key++}>{text.slice(lastIndex, index)}</span>)
    }
    result.push(
      <mark key={key++} className="rounded bg-yellow-200 px-0.5 text-foreground">
        {text.slice(index, index + query.length)}
      </mark>
    )
    lastIndex = index + query.length
    index = lowerText.indexOf(lowerQuery, lastIndex)
  }
  if (lastIndex < text.length) {
    result.push(<span key={key}>{text.slice(lastIndex)}</span>)
  }
  return result
}

export function StockCard({ item, searchQuery = '', onClick }: StockCardProps) {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(['super_admin', 'admin'])
  const { label, variant } = statusInfo(item.quantity, item.threshold)
  const max = Math.max(item.quantity, item.threshold)
  const progress = max > 0 ? (item.quantity / max) * 100 : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-transform active:scale-[0.98]"
      aria-label={`${item.productName}, ${item.quantity.toLocaleString()} ${item.productUnit}, statut ${label}`}
    >
      <span
        className={`absolute left-0 right-0 top-0 h-1 ${
          variant === 'success'
            ? 'bg-emerald-500'
            : variant === 'warning'
              ? 'bg-amber-500'
              : 'bg-rose-500'
        }`}
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-foreground">
              {highlightText(item.productName, searchQuery)}
            </h3>
            {item.category && (
              <p className="truncate text-sm text-muted-foreground">
                {highlightText(item.category, searchQuery)}
              </p>
            )}
            {!item.category && item.barcode && (
              <p className="truncate text-sm text-muted-foreground">
                Réf: {highlightText(item.barcode, searchQuery)}
              </p>
            )}
          </div>
          <StatusBadge variant={variant}>{label}</StatusBadge>
        </div>

        <div className="mb-2 flex items-baseline gap-1">
          <span className="text-[1.75rem] font-bold leading-none text-foreground">
            {item.quantity.toLocaleString()}
          </span>
          <span className="text-sm font-medium text-muted-foreground">{item.productUnit}</span>
        </div>

        {isAdmin && (item.costPrice > 0 || item.sellingPrice > 0) && (
          <div className="mb-3 grid grid-cols-3 gap-1 text-sm">
            <div className="rounded bg-muted px-2 py-1">
              <span className="block text-sm text-muted-foreground">PA</span>
              <span className="font-semibold text-foreground">
                {item.costPrice.toLocaleString()}
              </span>
            </div>
            <div className="rounded bg-muted px-2 py-1">
              <span className="block text-sm text-muted-foreground">PV</span>
              <span className="font-semibold text-foreground">
                {item.sellingPrice.toLocaleString()}
              </span>
            </div>
            <div className="rounded bg-muted px-2 py-1">
              <span className="block text-sm text-muted-foreground">Marge</span>
              <span className="font-semibold text-emerald-600">
                {(item.sellingPrice - item.costPrice).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        <div className="mt-auto">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                variant === 'success'
                  ? 'bg-emerald-500'
                  : variant === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
              style={{ width: `${String(Math.min(progress, 100))}%` }}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            mini: {item.threshold.toLocaleString()} {item.productUnit}
          </p>
        </div>
      </div>
    </button>
  )
}
