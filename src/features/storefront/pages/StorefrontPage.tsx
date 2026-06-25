import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, ShoppingCart, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createStorefrontOrder,
  getStorefrontBySlug,
  type StorefrontProduct,
} from '../services/storefrontService'

interface CartItem {
  productId: string
  name: string
  unit: string
  price: number
  quantity: number
  max: number
}

function formatCurrency(value: number, currency: string): string {
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export default function StorefrontPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [cart, setCart] = useState<CartItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState<{ orderId: string; orderNumber: string } | null>(
    null
  )

  const {
    data: storefront,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['storefront', orgSlug],
    queryFn: () => (orgSlug ? getStorefrontBySlug(orgSlug) : { organization: null, products: [] }),
    enabled: Boolean(orgSlug),
  })

  const organization = storefront?.organization ?? null

  const filteredProducts = useMemo(() => {
    const products = storefront?.products ?? []
    const query = search.trim().toLowerCase()
    if (!query) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.description ?? '').toLowerCase().includes(query) ||
        (p.barcode ?? '').toLowerCase().includes(query)
    )
  }, [storefront?.products, search])

  const addToCart = (product: StorefrontProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id && item.quantity < item.max
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      if (product.available <= 0) return prev
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          price: product.sellingPrice,
          quantity: 1,
          max: product.available,
        },
      ]
    })
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item
          const next = item.quantity + delta
          if (next < 1) return null
          if (next > item.max) return item
          return { ...item, quantity: next }
        })
        .filter((item): item is CartItem => item !== null)
    )
  }

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleSubmit = async () => {
    if (!orgSlug || !organization || cart.length === 0) return
    if (!customerName.trim() || !customerEmail.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await createStorefrontOrder(orgSlug, {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || null,
        address: address.trim() || null,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      })
      setOrderResult(result)
      setCart([])
      setCustomerName('')
      setCustomerEmail('')
      setCustomerPhone('')
      setAddress('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la commande')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Chargement de la boutique…</p>
      </div>
    )
  }

  const displayError = error ?? (queryError ? 'Erreur de chargement de la boutique.' : null)

  if (!organization) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Boutique non disponible</h1>
          <p className="text-muted-foreground">Cette boutique est inactive ou introuvable.</p>
        </div>
      </div>
    )
  }

  if (orderResult) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Commande enregistrée</h1>
          <p className="mt-2 text-muted-foreground">
            Votre commande <strong>#{orderResult.orderNumber}</strong> a bien été prise en compte.
          </p>
          <Button className="mt-6" onClick={() => setOrderResult(null)}>
            Nouvelle commande
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold">{organization.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{cart.length} article(s)</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {displayError && <p className="mb-4 text-destructive">{displayError}</p>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit…"
            />

            {filteredProducts.length === 0 ? (
              <p className="text-muted-foreground">Aucun produit disponible.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    disabled={product.available <= 0}
                    onClick={() => addToCart(product)}
                    className="flex items-center justify-between rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(product.sellingPrice, organization.currency)} /{' '}
                        {product.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">Stock: {product.available}</p>
                    </div>
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 font-semibold">Panier</h2>
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
              ) : (
                <ul className="space-y-3">
                  {cart.map((item) => (
                    <li key={item.productId} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.price, organization.currency)} / {item.unit}
                          </p>
                        </div>
                        <button type="button" onClick={() => removeItem(item.productId)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center">{item.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.productId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total, organization.currency)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 font-semibold">Informations client</h2>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Nom complet</Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="jean@exemple.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+225 01 23 45 67"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Adresse de livraison</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Abidjan, Cocody"
                  />
                </div>
              </div>

              <Button
                type="button"
                className="mt-4 w-full"
                disabled={
                  cart.length === 0 || !customerName.trim() || !customerEmail.trim() || submitting
                }
                onClick={handleSubmit}
              >
                {submitting ? 'Enregistrement…' : 'Valider la commande'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
