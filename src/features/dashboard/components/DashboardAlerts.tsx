import { CheckCircle2 } from 'lucide-react'
import type { StockItem } from '@/features/stock/services/stockService'
import { PageSection, StatusBadge } from '@/components/design-system'

interface DashboardAlertsProps {
  stock: StockItem[]
  onSelectItem: (item: StockItem) => void
}

export function DashboardAlerts({ stock, onSelectItem }: DashboardAlertsProps) {
  const alerts = stock.filter(
    (item) => item.quantity <= 0 || (item.quantity > 0 && item.quantity <= item.threshold)
  )

  return (
    <PageSection title="Alertes stock">
      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-base font-medium">Tous les stocks sont à niveau</span>
        </div>
      ) : (
        <ul className="divide-y">
          {alerts.map((item) => {
            const isRupture = item.quantity <= 0
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg py-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity.toLocaleString('fr-FR')} /{' '}
                      {item.threshold.toLocaleString('fr-FR')} {item.productUnit}
                    </p>
                  </div>
                  <StatusBadge variant={isRupture ? 'danger' : 'warning'}>
                    {isRupture ? 'Rupture' : 'Alerte'}
                  </StatusBadge>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </PageSection>
  )
}
