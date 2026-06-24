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
import { useProducts } from '@/features/products/hooks/useProducts'
import { useLocations } from '@/features/locations/hooks/useLocations'
import { useContacts } from '@/features/contacts/hooks/useContacts'
import { MovementForm } from '../components/MovementForm'
import { MovementList } from '../components/MovementList'
import { useCreateMovement, useMovements } from '../hooks/useMovements'

export default function MovementsPage() {
  const { data: movements, isLoading: movementsLoading, error: movementsError } = useMovements()
  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: locations, isLoading: locationsLoading } = useLocations()
  const { data: contacts, isLoading: contactsLoading } = useContacts()
  const create = useCreateMovement()
  const { hasRole } = useAuth()
  const canCreate = hasRole(['super_admin', 'admin', 'operator'])

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const isLoading = movementsLoading || productsLoading || locationsLoading || contactsLoading

  const handleSubmit = (input: {
    productId: string
    locationId: string
    targetLocationId: string | null
    type: import('@/types').MovementType
    quantity: number
    reason: string | null
    contactId: string | null
  }) => {
    create.mutate(input, {
      onSuccess: () => {
        setIsDialogOpen(false)
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mouvements</h1>
          <p className="text-muted-foreground">Historique des entrées, sorties et transferts.</p>
        </div>
        {canCreate && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button className="w-full sm:w-auto" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau mouvement
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau mouvement</DialogTitle>
                <DialogDescription>
                  Enregistrez une entrée, sortie, transfert ou ajustement.
                </DialogDescription>
              </DialogHeader>
              {products && locations && contacts && (
                <MovementForm
                  products={products}
                  locations={locations}
                  contacts={contacts}
                  onSubmit={handleSubmit}
                  onCancel={() => setIsDialogOpen(false)}
                  isLoading={create.isPending}
                />
              )}
              {create.error && <p className="text-sm text-destructive">{create.error.message}</p>}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {movementsError && <p className="text-destructive">{movementsError.message}</p>}
      {!isLoading && !movementsError && movements && <MovementList movements={movements} />}
    </div>
  )
}
