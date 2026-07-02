import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { MovementWithDetails } from '@/features/movements/services/movementService'
import { StatusBadge, type StatusBadgeVariant } from '@/components/design-system'
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
        const variants: Record<string, StatusBadgeVariant> = {
          IN: 'success',
          OUT: 'danger',
          INVENTORY: 'warning',
          ADJUSTMENT: 'warning',
          TRANSFER: 'warning',
        }
        return (
          <StatusBadge variant={variants[item.type] ?? 'neutral'}>
            {labels[item.type] ?? item.type}
          </StatusBadge>
        )
      },
    },
    {
      key: 'quantity',
      header: 'Qté',
      cell: (item) => item.quantity.toLocaleString(),
    },
  ]

  const empty = (
    <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
      Aucun mouvement dans la période.
    </div>
  )

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Détail des mouvements
        </h3>
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
