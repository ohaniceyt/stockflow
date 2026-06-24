import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/context/AuthContext'
import { LocationForm } from '../components/LocationForm'
import { LocationList } from '../components/LocationList'
import {
  useCreateLocation,
  useLocations,
  useSetDefaultLocation,
  useUpdateLocation,
} from '../hooks/useLocations'
import type { Location } from '@/types'
import type { LocationFormData } from '../schemas/locationSchema'

export default function LocationsPage() {
  const { session, hasRole } = useAuth()
  const { data: locations, isLoading, error } = useLocations()
  const create = useCreateLocation()
  const update = useUpdateLocation()
  const setDefault = useSetDefaultLocation()

  const canManage = hasRole(['super_admin', 'admin'])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)

  const handleCreate = (data: LocationFormData) => {
    create.mutate(data, {
      onSuccess: () => {
        setIsDialogOpen(false)
      },
    })
  }

  const handleUpdate = (data: LocationFormData) => {
    if (!editingLocation) return
    update.mutate(
      { id: editingLocation.id, ...data },
      {
        onSuccess: () => {
          setEditingLocation(null)
        },
      }
    )
  }

  const handleSetDefault = (location: Location) => {
    setDefault.mutate(location.id)
  }

  const handleEdit = (location: Location) => {
    setEditingLocation(location)
  }

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setEditingLocation(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Emplacements</h1>
          <p className="text-muted-foreground">Gérez les entrepôts et zones de stockage.</p>
        </div>
        {canManage && (
          <Button className="w-full sm:w-auto" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel emplacement
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {!isLoading && !error && locations && (
        <LocationList
          locations={locations}
          currentUserRole={session?.membership.role ?? 'operator'}
          onEdit={handleEdit}
          onSetDefault={handleSetDefault}
          isUpdating={create.isPending || update.isPending || setDefault.isPending}
        />
      )}

      <Dialog open={isDialogOpen || Boolean(editingLocation)} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Modifier' : 'Nouvel'} emplacement</DialogTitle>
            <DialogDescription>
              {editingLocation
                ? 'Mettez à jour les informations de cet emplacement.'
                : 'Créez un nouvel entrepôt ou zone de stockage.'}
            </DialogDescription>
          </DialogHeader>
          <LocationForm
            defaultValues={editingLocation ?? undefined}
            onSubmit={editingLocation ? handleUpdate : handleCreate}
            onCancel={() => handleOpenChange(false)}
            isLoading={create.isPending || update.isPending}
          />
          {(create.error ?? update.error) && (
            <p className="text-sm text-destructive">{(create.error ?? update.error)?.message}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
