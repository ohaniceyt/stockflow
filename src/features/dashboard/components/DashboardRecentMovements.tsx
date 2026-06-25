import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { MovementWithDetails } from '@/features/movements/services/movementService'

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

export function DashboardRecentMovements({
  movements,
  onSelectProduct,
}: DashboardRecentMovementsProps) {
  const recent = movements.slice(0, 10)

  return (
    <div className="card p-4">
      <h3 className="card-t">Derniers mouvements</h3>

      {recent.length === 0 ? (
        <p className="dash-empty">Aucun mouvement.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-faint)]">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Produit</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Qté</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 whitespace-nowrap text-[var(--text)]">
                    {format(new Date(m.createdAt), 'dd/MM HH:mm', { locale: fr })}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => onSelectProduct(m.productId, m.productName)}
                      className="block max-w-[140px] truncate text-left font-medium text-[var(--text-h)] hover:text-[var(--indigo)] hover:underline"
                    >
                      {m.productName ?? '—'}
                    </button>
                  </td>
                  <td className="py-2">
                    <span
                      className={`badge ${
                        m.type === 'IN' ? 'bd-g' : m.type === 'OUT' ? 'bd-r' : 'bd-y'
                      }`}
                    >
                      {typeLabels[m.type] ?? m.type}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium text-[var(--text-h)]">
                    {m.quantity.toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
