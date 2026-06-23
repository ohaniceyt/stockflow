import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, CheckCircle2, XCircle } from 'lucide-react'
import type { SessionWithDetails } from '../services/inventoryService'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

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
  const columns: ResponsiveColumn<SessionWithDetails>[] = [
    {
      key: 'name',
      header: 'Nom',
      cell: (session) => session.name,
      className: 'font-medium',
    },
    { key: 'location', header: 'Emplacement', cell: (session) => session.locationName ?? '—' },
    {
      key: 'status',
      header: 'Statut',
      cell: (session) => (
        <Badge variant={statusVariants[session.status]}>{statusLabels[session.status]}</Badge>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      cell: (session) => new Date(session.startedAt).toLocaleDateString('fr-FR'),
    },
    { key: 'operator', header: 'Opérateur', cell: (session) => session.operatorName ?? '—' },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (session) => (
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
      ),
    },
  ]

  const empty = (
    <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
      Aucune session d'inventaire. Créez une nouvelle session pour commencer.
    </div>
  )

  return (
    <ResponsiveTable
      data={sessions}
      columns={columns}
      keyExtractor={(session) => session.id}
      empty={empty}
      mobileCardTitle={(session) => session.name}
    />
  )
}
