import { useMemo, useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { StockItem } from '@/features/stock/services/stockService'
import type { Contact, Location, MovementType, Product } from '@/types'

interface MovementFormProps {
  products: Product[]
  locations: Location[]
  contacts: Contact[]
  stock?: StockItem[]
  onSubmit: (input: {
    productId: string
    locationId: string
    targetLocationId: string | null
    type: MovementType
    quantity: number
    reason: string | null
    contactId: string | null
    unitPrice?: number | null
  }) => void
  onCancel: () => void
  isLoading?: boolean
}

function sanitizeNumber(value: string): number {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function findStockLevel(
  stock: StockItem[] | undefined,
  productId: string,
  locationId: string
): number | null {
  if (!stock || !productId || !locationId) {
    return null
  }
  return stock.find((s) => s.productId === productId && s.locationId === locationId)?.quantity ?? 0
}

export function MovementForm({
  products,
  locations,
  contacts,
  stock,
  onSubmit,
  onCancel,
  isLoading,
}: MovementFormProps) {
  const defaultLocation = locations.find((l) => l.isDefault)
  const [type, setType] = useState<MovementType>('OUT')
  const [productId, setProductId] = useState('')
  const [locationId, setLocationId] = useState(defaultLocation?.id ?? '')
  const [targetLocationId, setTargetLocationId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [contactId, setContactId] = useState('')
  const [unitPrice, setUnitPrice] = useState<string>('')
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  const activeProducts = products.filter((p) => p.isActive)
  const selectedProduct = useMemo(
    () => activeProducts.find((p) => p.id === productId),
    [activeProducts, productId]
  )

  const currentStock = useMemo(
    () => (type === 'ADJUSTMENT' ? findStockLevel(stock, productId, locationId) : null),
    [type, stock, productId, locationId]
  )

  const contactType = type === 'IN' ? 'SUPPLIER' : type === 'OUT' ? 'CUSTOMER' : null
  const filteredContacts = contactType
    ? contacts.filter((c) => c.type === contactType && c.isActive)
    : []

  const handleTypeChange = (next: MovementType) => {
    setType(next)
    setContactId('')
    if (next !== 'OUT') {
      setUnitPrice('')
    } else if (selectedProduct) {
      setUnitPrice(String(selectedProduct.sellingPrice))
    }

    if (next === 'ADJUSTMENT' && productId && locationId) {
      setQuantity(findStockLevel(stock, productId, locationId) ?? 0)
    }
  }

  const handleProductChange = (id: string) => {
    setProductId(id)
    const product = activeProducts.find((p) => p.id === id)
    if (type === 'OUT' && product) {
      setUnitPrice(String(product.sellingPrice))
    }
    if (type === 'ADJUSTMENT' && id && locationId) {
      setQuantity(findStockLevel(stock, id, locationId) ?? 0)
    }
  }

  const validate = () => {
    const next: Partial<Record<string, string>> = {}
    if (!productId) next.productId = 'Sélectionnez un produit'
    if (!locationId) next.locationId = "Sélectionnez un emplacement d'origine"
    if (type === 'TRANSFER' && !targetLocationId)
      next.targetLocationId = 'Sélectionnez un emplacement de destination'
    if (!Number.isInteger(quantity)) {
      next.quantity = 'La quantité doit être un nombre entier'
    } else if (type === 'ADJUSTMENT') {
      if (quantity < 0) next.quantity = 'Le nouveau stock ne peut pas être négatif'
    } else if (quantity <= 0) {
      next.quantity = 'La quantité doit être positive'
    }
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
      contactId: contactId || null,
      unitPrice: type === 'OUT' ? sanitizeNumber(unitPrice) || null : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="type">Type de mouvement</Label>
        <Select
          id="type"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as MovementType)}
        >
          <option value="IN">Entrée (+)</option>
          <option value="OUT">Sortie (-)</option>
          <option value="TRANSFER">Transfert</option>
          <option value="ADJUSTMENT">Ajustement</option>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="productId">Produit</Label>
        <Select
          id="productId"
          value={productId}
          onChange={(e) => handleProductChange(e.target.value)}
        >
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
        <Select id="locationId" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
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

      {type === 'OUT' && (
        <div className="space-y-2">
          <Label htmlFor="contactId">Client</Label>
          <Select id="contactId" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Choisir un client (optionnel)</option>
            {filteredContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {type === 'IN' && filteredContacts.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="contactId">Fournisseur</Label>
          <Select id="contactId" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Choisir un fournisseur (optionnel)</option>
            {filteredContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quantity">{type === 'ADJUSTMENT' ? 'Nouveau stock' : 'Quantité'}</Label>
          <Input
            id="quantity"
            type="number"
            min={type === 'ADJUSTMENT' ? 0 : 1}
            value={quantity}
            onChange={(e) => {
              const raw = e.target.value
              setQuantity(raw === '' ? 0 : Number(raw))
            }}
          />
          {type === 'ADJUSTMENT' && currentStock !== null && (
            <p className="text-xs text-muted-foreground">
              Stock actuel : {currentStock}
              {quantity !== currentStock && (
                <>
                  {' — Ajustement : '}
                  {quantity > currentStock ? '+' : ''}
                  {quantity - currentStock}
                </>
              )}
            </p>
          )}
          {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
        </div>

        {type === 'OUT' && (
          <div className="space-y-2">
            <Label htmlFor="unitPrice">Prix de vente unitaire</Label>
            <Input
              id="unitPrice"
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder={selectedProduct ? String(selectedProduct.sellingPrice) : '0'}
            />
          </div>
        )}

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
