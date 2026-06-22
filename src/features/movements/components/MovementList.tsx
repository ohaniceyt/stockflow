import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { MovementWithDetails } from '../services/movementService'

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
  if (movements.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Aucun mouvement enregistré.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Produit</TableHead>
          <TableHead>Emplacement</TableHead>
          <TableHead>Quantité</TableHead>
          <TableHead>Stock avant/après</TableHead>
          <TableHead>Opérateur</TableHead>
          <TableHead>Motif</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="whitespace-nowrap">
              {format(new Date(m.createdAt), 'dd/MM HH:mm', { locale: fr })}
            </TableCell>
            <TableCell>
              <Badge variant={typeVariants[m.type]}>{typeLabels[m.type] ?? m.type}</Badge>
            </TableCell>
            <TableCell>{m.productName ?? '—'}</TableCell>
            <TableCell>
              {m.locationName ?? '—'}
              {m.targetLocationName && (
                <span className="text-muted-foreground"> → {m.targetLocationName}</span>
              )}
            </TableCell>
            <TableCell>{m.quantity.toLocaleString()}</TableCell>
            <TableCell>
              {m.stockBefore} → {m.stockAfter}
            </TableCell>
            <TableCell>{m.operatorName ?? '—'}</TableCell>
            <TableCell className="text-muted-foreground">{m.reason ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
