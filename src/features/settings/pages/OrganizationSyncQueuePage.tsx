import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, PageSection, StatusBadge } from '@/components/design-system'
import {
  cancelOrgOperation,
  listOrgPendingOperations,
  resetOrgOperation,
  type OrgPendingOperation,
} from '../services/orgQueueService'
import { useSync } from '@/features/offline/hooks/useSync'
import { db } from '@/lib/db'

const STATUSES: { value: OrgPendingOperation['status'] | ''; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'syncing', label: 'En cours' },
  { value: 'failed', label: 'Échoué' },
  { value: 'dead', label: 'Bloqué' },
  { value: 'cancelled', label: 'Annulé' },
]

const QUEUE_QUERY_KEY = ['settings', 'org-sync-queue']

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('fr-FR')
}

export default function OrganizationSyncQueuePage() {
  const [statusFilter, setStatusFilter] = useState<OrgPendingOperation['status'] | ''>('')
  const [selectedOp, setSelectedOp] = useState<OrgPendingOperation | null>(null)
  const [offset, setOffset] = useState(0)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const limit = 50
  const queryClient = useQueryClient()
  const { sync } = useSync()

  const filters = {
    status: statusFilter || undefined,
    limit,
    offset,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: [...QUEUE_QUERY_KEY, filters],
    queryFn: () => listOrgPendingOperations(filters),
  })

  const operations = data?.operations ?? []
  const total = data?.total ?? 0

  const handleCancel = async (op: OrgPendingOperation) => {
    try {
      setActionError(null)
      // Remove from local Dexie queue if it is still present.
      await db.pendingOperations.delete(op.clientOperationId)
      await cancelOrgOperation(op.clientOperationId)
      setActionMessage(`Opération ${op.type} annulée`)
      void queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de l’annulation'
      setActionError(message)
    }
  }

  const handleRetry = async (op: OrgPendingOperation) => {
    try {
      setActionError(null)
      // Reset local entry if it still exists.
      const local = await db.pendingOperations.get(op.clientOperationId)
      if (local) {
        await db.pendingOperations.update(op.clientOperationId, {
          status: 'failed',
          retryCount: 0,
          nextRetryAt: undefined,
          error: undefined,
        })
      }
      await resetOrgOperation(op.clientOperationId)
      setActionMessage(`Opération ${op.type} relancée`)
      void queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY })
      void sync()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec du relancement'
      setActionError(message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="File de synchronisation"
        description="Gérez les opérations en attente ou bloquées de l’organisation."
      />

      <PageSection>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrgPendingOperation['status'] | '')
              setOffset(0)
            }}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => void sync()}>
            Synchroniser maintenant
          </Button>
        </div>

        {actionMessage && <p className="text-sm text-green-600">{actionMessage}</p>}
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        {error && <p className="text-destructive">{error.message}</p>}

        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : (
          <>
            <div className="rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horodatage</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Erreur</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucune opération.
                      </TableCell>
                    </TableRow>
                  )}
                  {operations.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(op.createdAt)}
                      </TableCell>
                      <TableCell>{op.type}</TableCell>
                      <TableCell>
                        <StatusBadge variant={statusVariant(op.status)}>{op.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {op.error ?? '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedOp(op)}>
                            Détails
                          </Button>
                          {(op.status === 'failed' || op.status === 'dead') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleRetry(op)}
                            >
                              Réessayer
                            </Button>
                          )}
                          {op.status !== 'syncing' && op.status !== 'completed' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => void handleCancel(op)}
                            >
                              Annuler
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1} – {Math.min(offset + operations.length, total)} sur {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + operations.length >= total}
                onClick={() => setOffset((o) => o + limit)}
              >
                Suivant
              </Button>
            </div>
          </>
        )}
      </PageSection>

      <Dialog open={!!selectedOp} onOpenChange={(open) => !open && setSelectedOp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails de l’opération</DialogTitle>
            <DialogDescription>
              {selectedOp && `${selectedOp.type} — ${selectedOp.status}`}
            </DialogDescription>
          </DialogHeader>
          {selectedOp && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">ID client : </span>
                {selectedOp.clientOperationId}
              </p>
              <p>
                <span className="font-medium">Créée le : </span>
                {formatDate(selectedOp.createdAt)}
              </p>
              <p>
                <span className="font-medium">Mise à jour le : </span>
                {formatDate(selectedOp.updatedAt)}
              </p>
              <p>
                <span className="font-medium">Tentatives : </span>
                {selectedOp.retryCount}
              </p>
              {selectedOp.error && (
                <p className="text-destructive">
                  <span className="font-medium">Erreur : </span>
                  {selectedOp.error}
                </p>
              )}
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(selectedOp.payload, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function statusVariant(
  status: OrgPendingOperation['status']
): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'pending':
    case 'syncing':
      return 'neutral'
    case 'failed':
      return 'warning'
    case 'dead':
    case 'cancelled':
      return 'danger'
    default:
      return 'neutral'
  }
}
