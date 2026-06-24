import { CheckCircle2 } from 'lucide-react'
import type { StockItem } from '@/features/stock/services/stockService'

interface DashboardAlertsProps {
  stock: StockItem[]
  onSelectItem: (item: StockItem) => void
}

export function DashboardAlerts({ stock, onSelectItem }: DashboardAlertsProps) {
  const alerts = stock.filter(
    (item) => item.quantity <= 0 || (item.quantity > 0 && item.quantity <= item.threshold)
  )

  return (
    <div className="card p-4">
      <h3 className="card-t">Alertes stock</h3>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--emerald)]">
          <CheckCircle2 className="h-4 w-4" />
          Tous les stocks sont à niveau ✅
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((item) => {
            const isRupture = item.quantity <= 0
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="sk w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-[var(--text-h)]">
                      {item.productName}
                    </span>
                    <span className={isRupture ? 'bd-r' : 'bd-y'}>
                      {isRupture ? 'Rupture' : 'Alerte'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text)]">
                    {item.quantity.toLocaleString('fr-FR')} /{' '}
                    {item.threshold.toLocaleString('fr-FR')} {item.productUnit}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
