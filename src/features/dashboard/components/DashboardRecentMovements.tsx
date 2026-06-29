import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { MovementWithDetails } from '@/features/movements/services/movementService'
import { PageSection, StatusBadge, EmptyState } from '@/components/design-system'
import { ArrowRightLeft } from 'lucide-react'

interface DashboardRecentMovementsProps {
  movements: MovementWithDetails[]
  onSelectProduct: (productId: string, productName?: string) => void
}

const typeLabels: Record<string, string> = {
  IN: 'Entrée',
  OUT: 'Sortie',
  TRANSFER: 'Transfert',
  INVENTORY: 'Inventaire',
  ADJUSTMENT: 'Ajustement',
}

const typeBadgeVariant = (type: string) => {
  switch (type) {
    case 'IN':
      return 'success'
    case 'OUT':
      return 'danger'
    default:
      return 'warning'
  }
}

export function DashboardRecentMovements({
  movements,
  onSelectProduct,
}: DashboardRecentMovementsProps) {
  const recent = movements.slice(0, 10)

  if (recent.length === 0) {
    return (
      <PageSection title="Derniers mouvements">
        <EmptyState
          icon={ArrowRightLeft}
          title="Aucun mouvement"
          description="Les entrées, sorties et transferts récents apparaîtront ici."
        />
      </PageSection>
    )
  }

  return (
    <PageSection title="Derniers mouvements">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium">Produit</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium text-right">Qté</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="py-2 whitespace-nowrap text-foreground">
                  {format(new Date(m.createdAt), 'dd/MM HH:mm', { locale: fr })}
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => onSelectProduct(m.productId, m.productName)}
                    className="block max-w-[180px] truncate text-left font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {m.productName ?? '—'}
                  </button>
                </td>
                <td className="py-2">
                  <StatusBadge variant={typeBadgeVariant(m.type)}>
                    {typeLabels[m.type] ?? m.type}
                    {m.isCancelled && <span className="ml-1 font-normal">(annulé)</span>}
                  </StatusBadge>
                </td>
                <td className="py-2 text-right font-semibold text-foreground">
                  {m.quantity.toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {recent.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelectProduct(m.productId, m.productName)}
                className="block w-full truncate text-left font-medium text-foreground hover:text-primary hover:underline"
              >
                {m.productName ?? '—'}
              </button>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{format(new Date(m.createdAt), 'dd/MM HH:mm', { locale: fr })}</span>
                <StatusBadge variant={typeBadgeVariant(m.type)}>
                  {typeLabels[m.type] ?? m.type}
                  {m.isCancelled && <span className="ml-1 font-normal">(annulé)</span>}
                </StatusBadge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">
                {m.quantity.toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  )
}
