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
  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useInventorySessions()
  const { data: locations } = useLocations()
  const create = useCreateInventorySession()
  const apply = useApplyInventorySession()

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

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
    if (!selectedSession) return
    apply.mutate(selectedSession.id, {
      onSuccess: () => {
        setDetailOpen(false)
        setSelectedSession(null)
      },
    })
  }

  const handleApplyFromList = (s: SessionWithDetails) => {
    setSelectedSession(s)
    apply.mutate(s.id, {
      onSuccess: () => {
        setSelectedSession(null)
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

      {sessionsLoading && <p className="text-muted-foreground">Chargement des sessions…</p>}
      {sessionsError && <p className="text-destructive">{sessionsError.message}</p>}
      {!sessionsLoading && !sessionsError && sessions && (
        <InventorySessionList
          sessions={sessions}
          onOpen={handleOpen}
          onApply={canManage ? handleApplyFromList : undefined}
          isApplying={apply.isPending}
        />
      )}

      {locations && (
        <CreateSessionDialog
          locations={locations}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreate}
          isLoading={create.isPending}
        />
      )}

      <SessionDetailDialog
        session={selectedSession}
        counts={counts ?? []}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdateCount={handleUpdateCount}
        onApply={handleApply}
        isLoading={countsLoading || updateCount.isPending || apply.isPending}
      />
    </div>
  )
}
