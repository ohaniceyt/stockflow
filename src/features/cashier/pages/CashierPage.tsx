import { useMemo, useState } from 'react'
import { Minus, Plus, ShoppingCart, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useContacts } from '@/features/contacts/hooks/useContacts'
import { useCreateMovement } from '@/features/movements/hooks/useMovements'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useLocations } from '@/features/locations/hooks/useLocations'
import { useStock } from '@/features/stock/hooks/useStock'
import type { Product } from '@/types'

interface CartItem {
  id: string
  productId: string
  productName: string
  productUnit: string
  locationId: string
  locationName: string
  sellingPrice: number
  quantity: number
  stock: number
}

interface CustomerOption {
  id: string
  label: string
}

function formatCurrency(value: number): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function CashierPage() {
  const { session } = useAuth()
  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: locations, isLoading: locationsLoading } = useLocations()
  const { data: stock, isLoading: stockLoading } = useStock()
  const { data: customers } = useContacts('CUSTOMER')
  const create = useCreateMovement()

  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [customerId, setCustomerId] = useState('walk-in')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [note, setNote] = useState('')
  const [success, setSuccess] = useState(false)

  const defaultLocation = locations?.find((l) => l.isDefault)
  const activeLocationId =
    selectedLocationId.length > 0 ? selectedLocationId : (defaultLocation?.id ?? '')

  const customerOptions: CustomerOption[] = useMemo(() => {
    const base =
      customers?.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name })) ?? []
    return [{ id: 'walk-in', label: 'Client de passage' }, ...base]
  }, [customers])

  const availableProducts = useMemo(() => {
    if (!products || !stock || !activeLocationId) return []
    const activeProducts = products.filter((p) => p.isActive)
    return activeProducts.map((product) => {
      const stockItem = stock.find(
        (s) => s.productId === product.id && s.locationId === activeLocationId
      )
      return {
        ...product,
        locationId: activeLocationId,
        locationName: defaultLocation?.name ?? '',
        available: stockItem?.quantity ?? 0,
      }
    })
  }, [products, stock, activeLocationId, defaultLocation?.name])

  const addToCart = (
    product: Product & { locationId: string; locationName: string; available: number }
  ) => {
    const existing = cart.find(
      (item) => item.productId === product.id && item.locationId === product.locationId
    )
    if (existing) {
      setCart((prev) =>
        prev.map((item) =>
          item.id === existing.id && item.quantity < product.available
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
      return
    }
    if (product.available <= 0) return
    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        productUnit: product.unit,
        locationId: product.locationId,
        locationName: product.locationName,
        sellingPrice: product.sellingPrice,
        quantity: 1,
        stock: product.available,
      },
    ])
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const next = item.quantity + delta
        if (next < 1) return item
        if (next > item.stock) return item
        return { ...item, quantity: next }
      })
    )
  }

  const updatePrice = (itemId: string, price: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, sellingPrice: price } : item))
    )
  }

  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId))
  }

  const total = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0)

  const handleCheckout = () => {
    if (cart.length === 0) return
    setSuccess(false)

    const customerContactId = customerId === 'walk-in' ? null : customerId
    const reason = note.trim() || null

    let completed = 0
    let failed = false

    for (const item of cart) {
      create.mutate(
        {
          productId: item.productId,
          locationId: item.locationId,
          targetLocationId: null,
          type: 'OUT',
          quantity: item.quantity,
          reason,
          contactId: customerContactId,
          unitPrice: item.sellingPrice,
        },
        {
          onSuccess: () => {
            completed += 1
            if (completed === cart.length && !failed) {
              setCart([])
              setNote('')
              setCustomerId('walk-in')
              setNewCustomerName('')
              setSuccess(true)
            }
          },
          onError: () => {
            failed = true
          },
        }
      )
    }
  }

  if (productsLoading || locationsLoading || stockLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold">Caisse</h1>
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caisse</h1>
          <p className="text-muted-foreground">Ventes rapides pour {session?.organization.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} article(s)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="location">Emplacement</Label>
                <Select
                  id="location"
                  value={activeLocationId}
                  onChange={(e) => {
                    setSelectedLocationId(e.target.value)
                    setCart([])
                  }}
                >
                  {locations?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.isDefault && '(défaut)'}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="customer">Client</Label>
                <Select
                  id="customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  {customerOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {customerId === 'walk-in' && (
              <div className="mb-4 flex gap-2">
                <Input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Nom du client de passage"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!newCustomerName.trim()}
                  onClick={() => {
                    setNote((prev) =>
                      prev ? `${prev} — ${newCustomerName.trim()}` : newCustomerName.trim()
                    )
                    setNewCustomerName('')
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="products-list">Produits disponibles</Label>
              {availableProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun produit disponible à cet emplacement.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {availableProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      disabled={product.available <= 0}
                      onClick={() => addToCart(product)}
                      className="flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(product.sellingPrice)} / {product.unit} — stock:{' '}
                          {product.available}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Panier</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Le panier est vide.</p>
            ) : (
              <ul className="space-y-3">
                {cart.map((item) => (
                  <li key={item.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.locationName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Label htmlFor={`price-${item.id}`} className="text-xs text-muted-foreground">
                        Prix unit.
                      </Label>
                      <Input
                        id={`price-${item.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.sellingPrice}
                        onChange={(e) => updatePrice(item.id, Number(e.target.value))}
                        className="h-8"
                      />
                    </div>
                    <p className="mt-2 text-right text-sm font-medium">
                      {formatCurrency(item.sellingPrice * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 border-t pt-4">
              <div className="space-y-1">
                <Label htmlFor="note">Note</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Référence, remise…"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <Button
                type="button"
                className="mt-4 w-full"
                disabled={cart.length === 0 || create.isPending}
                onClick={handleCheckout}
              >
                {create.isPending ? 'Enregistrement…' : 'Valider la vente'}
              </Button>
              {success && (
                <p className="mt-2 text-center text-sm text-green-600">Vente enregistrée.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
