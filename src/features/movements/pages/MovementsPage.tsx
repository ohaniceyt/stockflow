import { useMemo, useState } from 'react'
import { Plus, ListPlus, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useLocations } from '@/features/locations/hooks/useLocations'
import { useContacts } from '@/features/contacts/hooks/useContacts'
import { useStock } from '@/features/stock/hooks/useStock'
import { MovementForm } from '../components/MovementForm'
import { BulkMovementForm } from '../components/BulkMovementForm'
import { MovementList } from '../components/MovementList'
import { useCreateBulkMovements, useCreateMovement, useMovements } from '../hooks/useMovements'
import { PageHeader, PageSection, EmptyState } from '@/components/design-system'
import type { MovementType } from '@/types'

type DialogMode = 'single' | 'bulk' | null

export default function MovementsPage() {
  const {
    data: movements,
    isLoading: movementsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: movementsError,
  } = useMovements()
  const { data: products, isLoading: productsLoading, error: productsError } = useProducts()
  const { data: locations, isLoading: locationsLoading, error: locationsError } = useLocations()
  const { data: contacts, isLoading: contactsLoading, error: contactsError } = useContacts()
  const create = useCreateMovement()
  const createBulk = useCreateBulkMovements()
  const { data: stock } = useStock()
  const { hasRole } = useAuth()
  const canCreate = hasRole(['super_admin', 'admin', 'operator'])

  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [contactFilter, setContactFilter] = useState<string>('all')

  const isLoading = movementsLoading || productsLoading || locationsLoading || contactsLoading

  const customers = useMemo(() => {
    return (contacts ?? []).filter((c) => c.type === 'CUSTOMER')
  }, [contacts])

  const filteredMovements = useMemo(() => {
    if (contactFilter === 'all') return movements
    if (contactFilter === 'none') return movements.filter((m) => !m.contactId)
    return movements.filter((m) => m.contactId === contactFilter)
  }, [movements, contactFilter])

  const handleSingleSubmit = (input: {
    productId: string
    locationId: string
    targetLocationId: string | null
    type: MovementType
    quantity: number
    reason: string | null
    contactId: string | null
  }) => {
    create.mutate(input, {
      onSuccess: () => setDialogMode(null),
    })
  }

  const handleBulkSubmit = (
    inputs: {
      productId: string
      locationId: string
      targetLocationId: string | null
      type: MovementType
      quantity: number
      reason: string | null
      contactId: string | null
    }[]
  ) => {
    createBulk.mutate(inputs, {
      onSuccess: () => setDialogMode(null),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mouvements"
        description="Historique des entrées, sorties et transferts."
        actions={
          canCreate
            ? [
                <Button key="bulk" variant="outline" onClick={() => setDialogMode('bulk')}>
                  <ListPlus className="mr-2 h-4 w-4" />
                  En bulk
                </Button>,
                <Button key="new" onClick={() => setDialogMode('single')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau mouvement
                </Button>,
              ]
            : undefined
        }
      />

      <Dialog open={dialogMode === 'single'} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau mouvement</DialogTitle>
            <DialogDescription>
              Enregistrez une entrée, sortie, transfert ou ajustement.
            </DialogDescription>
          </DialogHeader>
          {productsError || locationsError || contactsError ? (
            <p className="text-sm text-destructive">
              Impossible de charger les données nécessaires au formulaire.
            </p>
          ) : products && locations && products.length > 0 && locations.length > 0 ? (
            <MovementForm
              products={products}
              locations={locations}
              contacts={contacts ?? []}
              stock={stock}
              onSubmit={handleSingleSubmit}
              onCancel={() => setDialogMode(null)}
              isLoading={create.isPending}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun produit ou emplacement disponible. Créez-en au moins un pour enregistrer un
              mouvement.
            </p>
          )}
          {create.error && <p className="text-sm text-destructive">{create.error.message}</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === 'bulk'} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mouvements en bulk</DialogTitle>
            <DialogDescription>Enregistrez plusieurs mouvements à la suite.</DialogDescription>
          </DialogHeader>
          {productsError || locationsError || contactsError ? (
            <p className="text-sm text-destructive">
              Impossible de charger les données nécessaires au formulaire.
            </p>
          ) : products && locations && products.length > 0 && locations.length > 0 ? (
            <BulkMovementForm
              products={products}
              locations={locations}
              contacts={contacts ?? []}
              onSubmit={handleBulkSubmit}
              onCancel={() => setDialogMode(null)}
              isLoading={createBulk.isPending}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun produit ou emplacement disponible. Créez-en au moins un pour enregistrer des
              mouvements.
            </p>
          )}
          {createBulk.error && (
            <p className="text-sm text-destructive">{createBulk.error.message}</p>
          )}
        </DialogContent>
      </Dialog>

      {!isLoading && !movementsError && movements.length > 0 && (
        <PageSection contentClassName="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:w-72">
              <Label htmlFor="movement-contact-filter">Filtrer par client</Label>
              <Select
                id="movement-contact-filter"
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value)}
              >
                <option value="all">Tous les clients</option>
                <option value="none">Sans client</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </PageSection>
      )}

      {isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {movementsError && <p className="text-destructive">{movementsError.message}</p>}
      {!isLoading && !movementsError && movements.length > 0 && (
        <MovementList movements={filteredMovements} />
      )}
      {!isLoading && !movementsError && movements.length === 0 && (
        <EmptyState
          icon={ArrowLeftRight}
          title="Aucun mouvement"
          description="Les entrées, sorties, transferts et ajustements apparaîtront ici."
          action={
            canCreate ? (
              <Button onClick={() => setDialogMode('single')}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau mouvement
              </Button>
            ) : undefined
          }
        />
      )}
      {hasNextPage && (
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
        </Button>
      )}
    </div>
  )
}
