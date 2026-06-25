import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useLocations } from '@/features/locations/hooks/useLocations'
import {
  useApplyInventorySession,
  useCreateInventorySession,
  useInventorySessions,
  useSessionCounts,
  useUpdateCount,
} from '../hooks/useInventory'
import { InventorySessionList } from '../components/InventorySessionList'
import { CreateSessionDialog } from '../components/CreateSessionDialog'
import { SessionDetailDialog } from '../components/SessionDetailDialog'
import type { SessionWithDetails } from '../services/inventoryService'

export default function InventoryPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole(['super_admin', 'admin', 'operator'])
  const canApply = hasRole(['super_admin', 'admin'])
  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useInventorySessions()
  const { data: locations, isLoading: locationsLoading, error: locationsError } = useLocations()
  const create = useCreateInventorySession()
  const apply = useApplyInventorySession()

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [applyError, setApplyError] = useState<Error | null>(null)

  const { data: counts, isLoading: countsLoading } = useSessionCounts(selectedSession?.id ?? null)
  const updateCount = useUpdateCount(selectedSession?.id ?? '')

  const handleOpen = (s: SessionWithDetails) => {
    setSelectedSession(s)
    setDetailOpen(true)
  }

  const handleCreate = (input: { name: string; locationId: string }) => {
    create.mutate(input, {
      onSuccess: () => {
        setCreateOpen(false)
      },
    })
  }

  const handleUpdateCount = (countId: string, countedQuantity: number) => {
    updateCount.mutate({ countId, countedQuantity })
  }

  const handleApply = () => {
    if (!selectedSession || !canApply) return
    setApplyError(null)
    apply.mutate(selectedSession.id, {
      onSuccess: () => {
        setDetailOpen(false)
        setSelectedSession(null)
      },
      onError: (err) => {
        setApplyError(err)
      },
    })
  }

  const handleApplyFromList = (s: SessionWithDetails) => {
    if (!canApply) return
    setApplyError(null)
    setSelectedSession(s)
    apply.mutate(s.id, {
      onSuccess: () => {
        setSelectedSession(null)
      },
      onError: (err) => {
        setApplyError(err)
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventaire</h1>
          <p className="text-muted-foreground">Comptage et validation des écarts de stock.</p>
        </div>
        {canManage && (
          <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle session
          </Button>
        )}
      </div>

      {applyError && <p className="text-destructive">{applyError.message}</p>}
      {sessionsLoading && <p className="text-muted-foreground">Chargement des sessions…</p>}
      {sessionsError && <p className="text-destructive">{sessionsError.message}</p>}
      {!sessionsLoading && !sessionsError && sessions && (
        <InventorySessionList
          sessions={sessions}
          onOpen={handleOpen}
          onApply={canApply ? handleApplyFromList : undefined}
          isApplying={apply.isPending}
        />
      )}

      {locationsLoading && (
        <p className="text-sm text-muted-foreground">Chargement des emplacements…</p>
      )}
      {locationsError && <p className="text-sm text-destructive">{locationsError.message}</p>}
      {!locationsLoading && !locationsError && locations && (
        <CreateSessionDialog
          locations={locations}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreate}
          isLoading={create.isPending}
          error={create.error}
        />
      )}

      <SessionDetailDialog
        session={selectedSession}
        counts={counts ?? []}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdateCount={handleUpdateCount}
        onApply={handleApply}
        canApply={canApply}
        isLoading={countsLoading || updateCount.isPending || apply.isPending}
        isCountPending={updateCount.isPending}
        error={apply.error ?? updateCount.error}
      />
    </div>
  )
}
