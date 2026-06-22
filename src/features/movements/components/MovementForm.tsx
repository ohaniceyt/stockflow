import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { Location, MovementType, Product } from '@/types'

interface MovementFormProps {
  products: Product[]
  locations: Location[]
  onSubmit: (input: {
    productId: string
    locationId: string
    targetLocationId: string | null
    type: MovementType
    quantity: number
    reason: string | null
  }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function MovementForm({
  products,
  locations,
  onSubmit,
  onCancel,
  isLoading,
}: MovementFormProps) {
  const [type, setType] = useState<MovementType>('IN')
  const [productId, setProductId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [targetLocationId, setTargetLocationId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  const activeProducts = products.filter((p) => p.isActive)
  const defaultLocation = locations.find((l) => l.isDefault)

  const validate = () => {
    const next: Partial<Record<string, string>> = {}
    if (!productId) next.productId = 'Sélectionnez un produit'
    if (!locationId) next.locationId = "Sélectionnez un emplacement d'origine"
    if (type === 'TRANSFER' && !targetLocationId)
      next.targetLocationId = 'Sélectionnez un emplacement de destination'
    if (quantity <= 0) next.quantity = 'La quantité doit être positive'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      productId,
      locationId,
      targetLocationId: type === 'TRANSFER' ? targetLocationId : null,
      type,
      quantity,
      reason: reason.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="type">Type de mouvement</Label>
        <Select id="type" value={type} onChange={(e) => setType(e.target.value as MovementType)}>
          <option value="IN">Entrée (+)</option>
          <option value="OUT">Sortie (-)</option>
          <option value="TRANSFER">Transfert</option>
          <option value="ADJUSTMENT">Ajustement</option>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="productId">Produit</Label>
        <Select id="productId" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Choisir un produit…</option>
          {activeProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.unit})
            </option>
          ))}
        </Select>
        {errors.productId && <p className="text-xs text-destructive">{errors.productId}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="locationId">
          {type === 'TRANSFER' ? "Emplacement d'origine" : 'Emplacement'}
        </Label>
        <Select
          id="locationId"
          value={locationId || (defaultLocation?.id ?? '')}
          onChange={(e) => setLocationId(e.target.value)}
        >
          <option value="">Choisir un emplacement…</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} {l.isDefault && '(défaut)'}
            </option>
          ))}
        </Select>
        {errors.locationId && <p className="text-xs text-destructive">{errors.locationId}</p>}
      </div>

      {type === 'TRANSFER' && (
        <div className="space-y-2">
          <Label htmlFor="targetLocationId">Emplacement de destination</Label>
          <Select
            id="targetLocationId"
            value={targetLocationId}
            onChange={(e) => setTargetLocationId(e.target.value)}
          >
            <option value="">Choisir un emplacement…</option>
            {locations
              .filter((l) => l.id !== locationId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.isDefault && '(défaut)'}
                </option>
              ))}
          </Select>
          {errors.targetLocationId && (
            <p className="text-xs text-destructive">{errors.targetLocationId}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantité</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />
          {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Motif</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: livraison client"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  )
}
