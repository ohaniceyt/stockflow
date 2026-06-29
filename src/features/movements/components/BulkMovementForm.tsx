import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { Contact, Location, MovementType, Product } from '@/types'

interface BulkLine {
  id: string
  productId: string
  locationId: string
  targetLocationId: string | null
  type: MovementType
  quantity: number
  reason: string | null
  contactId: string | null
  unitPrice: string
}

interface BulkMovementFormProps {
  products: Product[]
  locations: Location[]
  contacts: Contact[]
  onSubmit: (
    lines: {
      productId: string
      locationId: string
      targetLocationId: string | null
      type: MovementType
      quantity: number
      reason: string | null
      contactId: string | null
      unitPrice: number | null
    }[]
  ) => void
  onCancel: () => void
  isLoading?: boolean
}

const typeOptions: { value: MovementType; label: string }[] = [
  { value: 'IN', label: 'Entrée (+)' },
  { value: 'OUT', label: 'Sortie (-)' },
  { value: 'TRANSFER', label: 'Transfert' },
  { value: 'ADJUSTMENT', label: 'Ajustement' },
]

function emptyLine(defaultLocationId: string): BulkLine {
  return {
    id: crypto.randomUUID(),
    productId: '',
    locationId: defaultLocationId,
    targetLocationId: null,
    type: 'OUT',
    quantity: 1,
    reason: null,
    contactId: null,
    unitPrice: '',
  }
}

export function BulkMovementForm({
  products,
  locations,
  contacts,
  onSubmit,
  onCancel,
  isLoading,
}: BulkMovementFormProps) {
  const defaultLocation = locations.find((l) => l.isDefault)
  const activeProducts = products.filter((p) => p.isActive)
  const [lines, setLines] = useState<BulkLine[]>(() => [emptyLine(defaultLocation?.id ?? '')])
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  function getProductSellingPrice(productId: string): string {
    const product = activeProducts.find((p) => p.id === productId)
    return product ? String(product.sellingPrice) : ''
  }

  const updateLine = (id: string, updates: Partial<BulkLine>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...updates } : line)))
  }

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(defaultLocation?.id ?? '')])
  }

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev))
  }

  function sanitizeNumber(value: string): number {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const validate = () => {
    const next: Partial<Record<string, string>> = {}
    lines.forEach((line, index) => {
      const prefix = `line-${String(index)}`
      if (!line.productId) next[`${prefix}-product`] = 'Sélectionnez un produit'
      if (!line.locationId) next[`${prefix}-location`] = "Sélectionnez un emplacement d'origine"
      if (line.type === 'TRANSFER' && !line.targetLocationId)
        next[`${prefix}-target`] = 'Sélectionnez une destination'
      if (line.quantity <= 0) next[`${prefix}-quantity`] = 'Quantité positive requise'
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit(
      lines.map((line) => ({
        productId: line.productId,
        locationId: line.locationId,
        targetLocationId: line.type === 'TRANSFER' ? line.targetLocationId : null,
        type: line.type,
        quantity: line.quantity,
        reason: (line.reason ?? '').trim() || null,
        contactId: line.contactId ?? null,
        unitPrice: line.type === 'OUT' ? sanitizeNumber(line.unitPrice) || null : null,
      }))
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {lines.map((line, index) => {
          const contactType =
            line.type === 'IN' ? 'SUPPLIER' : line.type === 'OUT' ? 'CUSTOMER' : null
          const filteredContacts = contactType
            ? contacts.filter((c) => c.type === contactType && c.isActive)
            : []

          return (
            <div key={line.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Ligne {String(index + 1)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length === 1 || isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`type-${line.id}`}>Type</Label>
                  <Select
                    id={`type-${line.id}`}
                    value={line.type}
                    onChange={(e) =>
                      updateLine(line.id, {
                        type: e.target.value as MovementType,
                        targetLocationId: null,
                        contactId: null,
                        unitPrice:
                          e.target.value === 'OUT' ? getProductSellingPrice(line.productId) : '',
                      })
                    }
                    disabled={isLoading}
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`product-${line.id}`}>Produit</Label>
                  <Select
                    id={`product-${line.id}`}
                    value={line.productId}
                    onChange={(e) =>
                      updateLine(line.id, {
                        productId: e.target.value,
                        unitPrice:
                          line.type === 'OUT'
                            ? getProductSellingPrice(e.target.value)
                            : line.unitPrice,
                      })
                    }
                    disabled={isLoading}
                  >
                    <option value="">Choisir…</option>
                    {activeProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit})
                      </option>
                    ))}
                  </Select>
                  {errors[`line-${String(index)}-product`] && (
                    <p className="text-sm text-destructive">
                      {errors[`line-${String(index)}-product`]}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`location-${line.id}`}>
                    {line.type === 'TRANSFER' ? 'Origine' : 'Emplacement'}
                  </Label>
                  <Select
                    id={`location-${line.id}`}
                    value={line.locationId}
                    onChange={(e) => updateLine(line.id, { locationId: e.target.value })}
                    disabled={isLoading}
                  >
                    <option value="">Choisir…</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.isDefault && '(défaut)'}
                      </option>
                    ))}
                  </Select>
                  {errors[`line-${String(index)}-location`] && (
                    <p className="text-sm text-destructive">
                      {errors[`line-${String(index)}-location`]}
                    </p>
                  )}
                </div>

                {line.type === 'TRANSFER' && (
                  <div className="space-y-1">
                    <Label htmlFor={`target-${line.id}`}>Destination</Label>
                    <Select
                      id={`target-${line.id}`}
                      value={line.targetLocationId ?? ''}
                      onChange={(e) => updateLine(line.id, { targetLocationId: e.target.value })}
                      disabled={isLoading}
                    >
                      <option value="">Choisir…</option>
                      {locations
                        .filter((l) => l.id !== line.locationId)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} {l.isDefault && '(défaut)'}
                          </option>
                        ))}
                    </Select>
                    {errors[`line-${String(index)}-target`] && (
                      <p className="text-sm text-destructive">
                        {errors[`line-${String(index)}-target`]}
                      </p>
                    )}
                  </div>
                )}

                {contactType && filteredContacts.length > 0 && (
                  <div className="space-y-1">
                    <Label htmlFor={`contact-${line.id}`}>
                      {line.type === 'IN' ? 'Fournisseur' : 'Client'}
                    </Label>
                    <Select
                      id={`contact-${line.id}`}
                      value={line.contactId ?? ''}
                      onChange={(e) => updateLine(line.id, { contactId: e.target.value })}
                      disabled={isLoading}
                    >
                      <option value="">{`Choisir un ${line.type === 'IN' ? 'fournisseur' : 'client'}`}</option>
                      {filteredContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor={`quantity-${line.id}`}>Quantité</Label>
                  <Input
                    id={`quantity-${line.id}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.id, {
                        quantity: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    disabled={isLoading}
                  />
                  {errors[`line-${String(index)}-quantity`] && (
                    <p className="text-sm text-destructive">
                      {errors[`line-${String(index)}-quantity`]}
                    </p>
                  )}
                </div>

                {line.type === 'OUT' && (
                  <div className="space-y-1">
                    <Label htmlFor={`unitPrice-${line.id}`}>Prix de vente unitaire</Label>
                    <Input
                      id={`unitPrice-${line.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor={`reason-${line.id}`}>Motif</Label>
                  <Input
                    id={`reason-${line.id}`}
                    value={line.reason ?? ''}
                    onChange={(e) => updateLine(line.id, { reason: e.target.value })}
                    placeholder="Ex: livraison client"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Button type="button" variant="outline" onClick={addLine} disabled={isLoading}>
        <Plus className="mr-2 h-4 w-4" />
        Ajouter une ligne
      </Button>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Enregistrement…' : `Enregistrer ${String(lines.length)} mouvement(s)`}
        </Button>
      </div>
    </form>
  )
}
