import { useEffect, useRef } from 'react'
import { X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { fetchMovementsByProduct } from '@/features/movements/services/movementService'
import type { StockItem } from '../services/stockService'

interface StockDetailOverlayProps {
  item: StockItem | null
  onClose: () => void
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function movementIcon(type: string) {
  switch (type) {
    case 'IN':
      return <ArrowDownLeft className="h-4 w-4 text-[var(--emerald)]" />
    case 'OUT':
      return <ArrowUpRight className="h-4 w-4 text-[var(--rose)]" />
    case 'TRANSFER':
      return <ArrowLeftRight className="h-4 w-4 text-[var(--amber)]" />
    default:
      return <Package className="h-4 w-4 text-[var(--text-faint)]" />
  }
}

function statusInfo(quantity: number, threshold: number) {
  if (quantity <= 0) {
    return { label: 'RUPTURE', className: 'bd-r' }
  }
  if (quantity <= threshold) {
    return { label: 'ALERTE', className: 'bd-y' }
  }
  return { label: 'OK', className: 'bd-g' }
}

export function StockDetailOverlay({ item, onClose }: StockDetailOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { hasRole, session } = useAuth()
  const isAdmin = hasRole(['super_admin', 'admin'])
  const orgId = session?.membership.orgId

  const {
    data: movements,
    isFetching: movementsLoading,
    error: movementsError,
  } = useQuery({
    queryKey: ['movements-by-product', orgId, item?.productId],
    queryFn: () => {
      if (!item || !orgId) return Promise.resolve([])
      return fetchMovementsByProduct(orgId, item.productId)
    },
    enabled: !!item && !!orgId,
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (item) {
      document.addEventListener('keydown', onKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [item, onClose])

  if (!item) return null

  const { label, className } = statusInfo(item.quantity, item.threshold)
  const max = Math.max(item.quantity, item.threshold)
  const progress = max > 0 ? (item.quantity / max) * 100 : 0
  const stockValue = item.quantity * item.costPrice
  const stockSellingValue = item.quantity * item.sellingPrice

  return (
    <div
      className="ov"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      role="button"
      tabIndex={0}
      aria-label="Fermer le détail"
    >
      <div ref={panelRef} className="ov-panel">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-wide text-[var(--text-faint)]">
              {item.category ?? 'Sans catégorie'}
            </p>
            <h2 id="stock-detail-title" className="text-xl font-bold text-[var(--text-h)]">
              {item.productName}
            </h2>
            {item.barcode && (
              <p className="text-sm text-[var(--text-faint)]">Réf: {item.barcode}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="btn-o btn-ic" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className={className}>{label}</span>
          <span className="text-sm text-[var(--text)]">
            {item.quantity.toLocaleString()} {item.productUnit} · mini{' '}
            {item.threshold.toLocaleString()}
          </span>
        </div>

        <div className="progress-track mb-1">
          <div
            className={`h-full rounded-full ${
              item.quantity <= 0
                ? 'bg-[var(--rose)]'
                : item.quantity <= item.threshold
                  ? 'bg-[var(--amber)]'
                  : 'bg-[var(--emerald)]'
            }`}
            style={{ width: `${String(Math.min(progress, 100))}%` }}
          />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="card p-3">
            <p className="text-sm text-[var(--text-faint)]">Emplacement</p>
            <p className="font-semibold text-[var(--text-h)]">{item.locationName}</p>
          </div>
          {isAdmin && (
            <>
              <div className="card p-3">
                <p className="text-sm text-[var(--text-faint)]">Valeur achat</p>
                <p className="font-semibold text-[var(--text-h)]">
                  {stockValue.toLocaleString()} FCFA
                </p>
              </div>
              <div className="card p-3">
                <p className="text-sm text-[var(--text-faint)]">Valeur vente</p>
                <p className="font-semibold text-[var(--text-h)]">
                  {stockSellingValue.toLocaleString()} FCFA
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-h)]">Derniers mouvements</h3>
          {movementsLoading && (
            <span className="text-sm text-[var(--text-faint)]">Chargement…</span>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto">
          {movementsLoading && !movements && (
            <p className="py-4 text-center text-sm text-[var(--text-faint)]">
              Chargement des mouvements…
            </p>
          )}
          {movementsError && (
            <p className="py-4 text-center text-sm text-destructive">
              Erreur de chargement des mouvements.
            </p>
          )}
          {!movementsLoading && !movementsError && (!movements || movements.length === 0) && (
            <p className="py-4 text-center text-sm text-[var(--text-faint)]">
              Aucun mouvement récent pour ce produit.
            </p>
          )}
          {movements && movements.length > 0 && (
            <ul className="space-y-2">
              {movements.slice(0, 20).map((m) => (
                <li key={m.id} className="card flex items-center gap-3 p-3">
                  {movementIcon(m.type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-h)]">
                      {m.type === 'IN' && 'Entrée'}
                      {m.type === 'OUT' && 'Sortie'}
                      {m.type === 'TRANSFER' && 'Transfert'}
                      {m.type === 'INVENTORY' && 'Inventaire'}
                      {m.type === 'ADJUSTMENT' && 'Ajustement'}{' '}
                      <span className="text-[var(--text)]">× {m.quantity.toLocaleString()}</span>
                    </p>
                    <p className="text-sm text-[var(--text-faint)]">
                      {m.locationName ?? m.locationId} · {m.operatorName ?? m.operatorId} ·{' '}
                      {formatDate(m.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--text-faint)]">Stock</p>
                    <p className="text-sm font-semibold text-[var(--text-h)]">
                      {m.stockBefore.toLocaleString()} → {m.stockAfter.toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
