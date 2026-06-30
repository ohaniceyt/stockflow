import { format, isValid, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/design-system'
import type { MovementType } from '@/types'
import type { MovementWithDetails } from '../services/movementService'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function formatMovementDate(value: string): string {
  const date = parseISO(value)
  if (!isValid(date)) return '—'
  return format(date, 'dd/MM HH:mm', { locale: fr })
}

interface MovementListProps {
  movements: MovementWithDetails[]
}

const typeLabels: Record<MovementType, string> = {
  IN: 'Entrée',
  OUT: 'Sortie',
  TRANSFER: 'Transfert',
  INVENTORY: 'Inventaire',
  ADJUSTMENT: 'Ajustement',
}

const typeVariants: Record<MovementType, BadgeVariant> = {
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
      cell: (m) => formatMovementDate(m.createdAt),
      className: 'whitespace-nowrap',
    },
    {
      key: 'type',
      header: 'Type',
      cell: (m) => <Badge variant={typeVariants[m.type]}>{typeLabels[m.type]}</Badge>,
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
      key: 'contact',
      header: 'Contact',
      cell: (m) => {
        if (!m.contactName) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-muted-foreground">
            {m.type === 'IN' && 'Fourni: '}
            {m.type === 'OUT' && 'Client: '}
            {m.contactName}
          </span>
        )
      },
    },
    {
      key: 'reason',
      header: 'Motif',
      cell: (m) => <span className="text-muted-foreground">{m.reason ?? '—'}</span>,
    },
  ]

  const empty = (
    <EmptyState
      title="Aucun mouvement"
      description="Les entrées, sorties, transferts et ajustements apparaîtront ici."
    />
  )

  return (
    <ResponsiveTable
      data={movements}
      columns={columns}
      keyExtractor={(m) => m.id}
      empty={empty}
      mobileCardTitle={(m) => (
        <span className="flex items-center gap-2">
          <Badge variant={typeVariants[m.type]}>{typeLabels[m.type]}</Badge>
          <span className="font-normal">{m.productName ?? '—'}</span>
        </span>
      )}
    />
  )
}
