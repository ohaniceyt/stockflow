import { useAuth } from '@/features/auth/context/AuthContext'
import type { StockItem } from '../services/stockService'

interface StockCardProps {
  item: StockItem
  searchQuery?: string
  onClick?: () => void
}

function statusInfo(quantity: number, threshold: number) {
  if (quantity <= 0) {
    return { label: 'RUPTURE', colorClass: 'bg-[var(--rose)]', badgeClass: 'bd-r' }
  }
  if (quantity <= threshold) {
    return { label: 'ALERTE', colorClass: 'bg-[var(--amber)]', badgeClass: 'bd-y' }
  }
  return { label: 'OK', colorClass: 'bg-[var(--emerald)]', badgeClass: 'bd-g' }
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
      <mark key={key++} className="rounded bg-yellow-200 px-0.5 text-[var(--text-h)]">
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
  const { label, colorClass, badgeClass } = statusInfo(item.quantity, item.threshold)
  const max = Math.max(item.quantity, item.threshold)
  const progress = max > 0 ? (item.quantity / max) * 100 : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="sk text-left"
      aria-label={`${item.productName}, ${item.quantity.toLocaleString()} ${item.productUnit}, statut ${label}`}
    >
      <div className={`status-bar ${colorClass}`} />

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-[var(--text-h)]">
              {highlightText(item.productName, searchQuery)}
            </h3>
            {item.category && (
              <p className="truncate text-xs text-[var(--text-faint)]">
                {highlightText(item.category, searchQuery)}
              </p>
            )}
            {!item.category && item.barcode && (
              <p className="truncate text-xs text-[var(--text-faint)]">
                Réf: {highlightText(item.barcode, searchQuery)}
              </p>
            )}
          </div>
          <span className={badgeClass}>{label}</span>
        </div>

        <div className="mb-2 flex items-baseline gap-1">
          <span className="text-[1.75rem] font-bold leading-none text-[var(--text-h)]">
            {item.quantity.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-[var(--text-faint)]">{item.productUnit}</span>
        </div>

        {isAdmin && (item.costPrice > 0 || item.sellingPrice > 0) && (
          <div className="mb-3 grid grid-cols-3 gap-1 text-xs">
            <div className="rounded bg-[var(--surface-2)] px-2 py-1">
              <span className="block text-[10px] text-[var(--text-faint)]">PA</span>
              <span className="font-semibold text-[var(--text)]">
                {item.costPrice.toLocaleString()}
              </span>
            </div>
            <div className="rounded bg-[var(--surface-2)] px-2 py-1">
              <span className="block text-[10px] text-[var(--text-faint)]">PV</span>
              <span className="font-semibold text-[var(--text)]">
                {item.sellingPrice.toLocaleString()}
              </span>
            </div>
            <div className="rounded bg-[var(--surface-2)] px-2 py-1">
              <span className="block text-[10px] text-[var(--text-faint)]">Marge</span>
              <span className="font-semibold text-[var(--emerald)]">
                {(item.sellingPrice - item.costPrice).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        <div className="mt-auto">
          <div className="progress-track">
            <div
              className={`h-full rounded-full transition-all ${colorClass}`}
              style={{ width: `${String(Math.min(progress, 100))}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-[var(--text-faint)]">
            mini: {item.threshold.toLocaleString()} {item.productUnit}
          </p>
        </div>
      </div>
    </button>
  )
}
