import { Button } from '@/components/ui/button'
import type { Location } from '@/types'

interface LocationListProps {
  locations: Location[]
  currentUserRole: string
  onEdit: (location: Location) => void
  onSetDefault: (location: Location) => void
  isUpdating: boolean
}

export function LocationList({
  locations,
  currentUserRole,
  onEdit,
  onSetDefault,
  isUpdating,
}: LocationListProps) {
  const canManage = ['super_admin', 'admin'].includes(currentUserRole)

  if (locations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucun emplacement. Créez-en un pour commencer.</p>
    )
  }

  return (
    <div className="space-y-2">
      {locations.map((location) => (
        <div
          key={location.id}
          className="flex items-start justify-between rounded-xl border p-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{location.name}</p>
              {location.isDefault && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Par défaut
                </span>
              )}
            </div>
            {location.description && (
              <p className="text-sm text-muted-foreground">{location.description}</p>
            )}
            {location.address && (
              <p className="text-sm text-muted-foreground">{location.address}</p>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              {!location.isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSetDefault(location)}
                  disabled={isUpdating}
                >
                  Définir par défaut
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onEdit(location)} disabled={isUpdating}>
                Modifier
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
