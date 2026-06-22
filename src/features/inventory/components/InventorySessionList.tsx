import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Eye, CheckCircle2, XCircle } from 'lucide-react'
import type { SessionWithDetails } from '../services/inventoryService'

interface InventorySessionListProps {
  sessions: SessionWithDetails[]
  onOpen: (session: SessionWithDetails) => void
  onApply?: (session: SessionWithDetails) => void
  onCancel?: (session: SessionWithDetails) => void
  isApplying?: boolean
}

const statusLabels: Record<string, string> = {
  pending: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  completed: 'default',
  cancelled: 'outline',
}

export function InventorySessionList({
  sessions,
  onOpen,
  onApply,
  onCancel,
  isApplying,
}: InventorySessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Aucune session d'inventaire. Créez une nouvelle session pour commencer.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Emplacement</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Opérateur</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow key={session.id}>
            <TableCell className="font-medium">{session.name}</TableCell>
            <TableCell>{session.locationName ?? '—'}</TableCell>
            <TableCell>
              <Badge variant={statusVariants[session.status]}>{statusLabels[session.status]}</Badge>
            </TableCell>
            <TableCell>{new Date(session.startedAt).toLocaleDateString('fr-FR')}</TableCell>
            <TableCell>{session.operatorName ?? '—'}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpen(session)}
                  aria-label={`Ouvrir ${session.name}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {session.status === 'pending' && onApply && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onApply(session)}
                    disabled={isApplying}
                    aria-label={`Appliquer ${session.name}`}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                )}
                {session.status === 'pending' && onCancel && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onCancel(session)}
                    disabled={isApplying}
                    aria-label={`Annuler ${session.name}`}
                  >
                    <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
