import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { MovementWithDetails } from '@/features/movements/services/movementService'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

interface RecapMovementsTableProps {
  movements: MovementWithDetails[]
}

export function RecapMovementsTable({ movements }: RecapMovementsTableProps) {
  const sortedMovements = [...movements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const columns: ResponsiveColumn<MovementWithDetails>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (item) => format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }),
    },
    {
      key: 'product',
      header: 'Produit',
      cell: (item) => item.productName ?? item.productId,
      className: 'font-medium',
    },
    {
      key: 'type',
      header: 'Type',
      cell: (item) => {
        const labels: Record<string, string> = {
          IN: 'Entrée',
          OUT: 'Sortie',
          INVENTORY: 'Inventaire',
          ADJUSTMENT: 'Ajustement',
          TRANSFER: 'Transfert',
        }
        const colors: Record<string, string> = {
          IN: 'bd-g',
          OUT: 'bd-r',
          INVENTORY: 'bd-y',
          ADJUSTMENT: 'bd-y',
          TRANSFER: 'bd-y',
        }
        return <span className={colors[item.type] ?? 'bd-y'}>{labels[item.type] ?? item.type}</span>
      },
    },
    {
      key: 'quantity',
      header: 'Qté',
      cell: (item) => item.quantity.toLocaleString(),
    },
  ]

  const empty = (
    <div className="dash-empty rounded-xl border bg-card p-8 text-center">
      Aucun mouvement dans la période.
    </div>
  )

  return (
    <div className="card overflow-hidden">
      <div className="border-b px-4 py-3">
        <h3 className="card-t mb-0">Détail des mouvements</h3>
      </div>
      <ResponsiveTable
        data={sortedMovements}
        columns={columns}
        keyExtractor={(item) => item.id}
        empty={empty}
        mobileCardTitle={(item) => item.productName ?? item.productId}
      />
    </div>
  )
}
