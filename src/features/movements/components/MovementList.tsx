import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import type { MovementWithDetails } from '../services/movementService'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

interface MovementListProps {
  movements: MovementWithDetails[]
}

const typeLabels: Record<string, string> = {
  IN: 'Entrée',
  OUT: 'Sortie',
  TRANSFER: 'Transfert',
  INVENTORY: 'Inventaire',
  ADJUSTMENT: 'Ajustement',
}

const typeVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  IN: 'default',
  OUT: 'secondary',
  TRANSFER: 'outline',
  INVENTORY: 'outline',
  ADJUSTMENT: 'outline',
}

export function MovementList({ movements }: MovementListProps) {
  const columns: ResponsiveColumn<MovementWithDetails>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (m) => format(new Date(m.createdAt), 'dd/MM HH:mm', { locale: fr }),
      className: 'whitespace-nowrap',
    },
    {
      key: 'type',
      header: 'Type',
      cell: (m) => <Badge variant={typeVariants[m.type]}>{typeLabels[m.type] ?? m.type}</Badge>,
    },
    { key: 'product', header: 'Produit', cell: (m) => m.productName ?? '—' },
    {
      key: 'location',
      header: 'Emplacement',
      cell: (m) => (
        <>
          {m.locationName ?? '—'}
          {m.targetLocationName && (
            <span className="text-muted-foreground"> → {m.targetLocationName}</span>
          )}
        </>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantité',
      cell: (m) => m.quantity.toLocaleString(),
    },
    {
      key: 'stock',
      header: 'Stock avant/après',
      cell: (m) => (
        <>
          {m.stockBefore} → {m.stockAfter}
        </>
      ),
    },
    { key: 'operator', header: 'Opérateur', cell: (m) => m.operatorName ?? '—' },
    {
      key: 'reason',
      header: 'Motif',
      cell: (m) => <span className="text-muted-foreground">{m.reason ?? '—'}</span>,
    },
  ]

  const empty = (
    <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
      Aucun mouvement enregistré.
    </div>
  )

  return (
    <ResponsiveTable
      data={movements}
      columns={columns}
      keyExtractor={(m) => m.id}
      empty={empty}
      mobileCardTitle={(m) => (
        <span className="flex items-center gap-2">
          <Badge variant={typeVariants[m.type]}>{typeLabels[m.type] ?? m.type}</Badge>
          <span className="font-normal">{m.productName ?? '—'}</span>
        </span>
      )}
    />
  )
}
