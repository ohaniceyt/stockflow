import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  UserPlus,
  Search,
  ScanBarcode,
  History,
  X,
  Unlock,
  Lock,
  AlertCircle,
  Upload,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useContacts } from '@/features/contacts/hooks/useContacts'
import { useMovements } from '@/features/movements/hooks/useMovements'
import ReceiptActions from '@/features/invoicing/components/ReceiptActions'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useLocations } from '@/features/locations/hooks/useLocations'
import { useStock } from '@/features/stock/hooks/useStock'
import {
  useCashierSession,
  useCloseCashierSession,
  useOpenCashierSession,
} from '@/features/cashier/hooks/useCashierSession'
import {
  cancelSale,
  completeSale,
  computeSessionRevenue,
  filterSalesBySession,
} from '@/features/cashier/services/cashierService'
import type { Product, ReceiptWithItems } from '@/types'

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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CashierPage() {
  const { session, hasRole } = useAuth()
  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: locations, isLoading: locationsLoading } = useLocations()
  const { data: stock, isLoading: stockLoading } = useStock()
  const { data: customers } = useContacts('CUSTOMER')
  const queryClient = useQueryClient()
  const { data: movements, isLoading: movementsLoading } = useMovements()
  const openSessionMutation = useOpenCashierSession()
  const closeSessionMutation = useCloseCashierSession()

  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [customerId, setCustomerId] = useState('walk-in')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [note, setNote] = useState('')
  const [success, setSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [openingBalanceInput, setOpeningBalanceInput] = useState('')
  const [closingBalanceInput, setClosingBalanceInput] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [scannerStarting, setScannerStarting] = useState(false)
  const [scannerCameras, setScannerCameras] = useState<{ id: string; label: string }[]>([])
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'card' | 'mobile_money' | 'transfer' | 'other'
  >('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [receipt, setReceipt] = useState<ReceiptWithItems | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const scannerContainerId = useMemo(() => `cashier-scanner-${crypto.randomUUID()}`, [])
  const scannerContainerRef = useRef<HTMLDivElement | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const defaultLocation = locations?.find((l) => l.isDefault)
  const activeLocationId =
    selectedLocationId.length > 0 ? selectedLocationId : (defaultLocation?.id ?? '')

  const { data: openSession, isLoading: sessionLoading } = useCashierSession(activeLocationId)

  const canCancelSales = hasRole(['super_admin', 'admin'])

  const customerOptions: CustomerOption[] = useMemo(() => {
    const base =
      customers?.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name })) ?? []
    return [{ id: 'walk-in', label: 'Client de passage' }, ...base]
  }, [customers])

  const availableProducts = useMemo(() => {
    if (!products || !stock || !activeLocationId) return []
    const activeProducts = products.filter((p) => p.isActive)
    const activeLocation = locations?.find((l) => l.id === activeLocationId)
    return activeProducts.map((product) => {
      const stockItem = stock.find(
        (s) => s.productId === product.id && s.locationId === activeLocationId
      )
      return {
        ...product,
        locationId: activeLocationId,
        locationName: activeLocation?.name ?? '',
        available: stockItem?.quantity ?? 0,
      }
    })
  }, [products, stock, activeLocationId, locations])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return availableProducts
    return availableProducts.filter(
      (p) => p.name.toLowerCase().includes(query) || (p.barcode ?? '').toLowerCase().includes(query)
    )
  }, [availableProducts, search])

  const sessionSales = useMemo(
    () => filterSalesBySession(movements, openSession?.id ?? null),
    [movements, openSession]
  )
  const sessionRevenue = useMemo(() => computeSessionRevenue(sessionSales), [sessionSales])

  const getSaleProductName = (sale: (typeof sessionSales)[number]) => {
    const detail =
      sale as unknown as import('@/features/movements/services/movementService').MovementWithDetails
    return detail.productName ?? 'Produit'
  }

  const addToCart = useCallback(
    (product: Product & { locationId: string; locationName: string; available: number }) => {
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
    },
    [cart]
  )

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

  const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0)
  const taxRate = session?.organization.hasTaxEnabled ? (session.organization.taxRate ?? 0) : 0
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100

  const handleCheckout = async () => {
    if (cart.length === 0 || !openSession || !session) return
    setSuccess(false)
    setIsCheckingOut(true)

    const customerContactId = customerId === 'walk-in' ? null : customerId
    const reason = note.trim() || null

    try {
      const org = session.organization
      const taxRate = org.hasTaxEnabled ? (org.taxRate ?? 0) : 0
      const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0)
      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
      const total = Math.round((subtotal + taxAmount) * 100) / 100
      const paid = Number(amountPaid) || total
      const changeDue = Math.max(0, Math.round((paid - total) * 100) / 100)

      const receiptItems = cart.map((item) => {
        const itemSubtotal = item.sellingPrice * item.quantity
        const itemTax = Math.round(itemSubtotal * (taxRate / 100) * 100) / 100
        return {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.sellingPrice,
          discountAmount: 0,
          taxAmount: itemTax,
          total: Math.round((itemSubtotal + itemTax) * 100) / 100,
        }
      })

      const createdReceipt = await completeSale({
        locationId: activeLocationId,
        cashierSessionId: openSession.id,
        contactId: customerContactId,
        paymentMethod,
        currency: org.currency,
        prefix: org.receiptPrefix,
        subtotal,
        taxAmount,
        total,
        amountPaid: paid,
        changeDue,
        notes: reason,
        items: receiptItems,
      })

      void queryClient.invalidateQueries({ queryKey: ['movements', session.membership.orgId] })
      void queryClient.invalidateQueries({ queryKey: ['stock', session.membership.orgId] })
      void queryClient.invalidateQueries({ queryKey: ['receipts', openSession.id] })

      setReceipt(createdReceipt)
      setShowReceipt(true)
      setCart([])
      setNote('')
      setCustomerId('walk-in')
      setNewCustomerName('')
      setAmountPaid('')
      setSuccess(true)
    } catch {
      // errors are surfaced by toast/query; keep UI state intact
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handleOpenSession = () => {
    const value = Number(openingBalanceInput)
    if (!activeLocationId || Number.isNaN(value)) return
    openSessionMutation.mutate(
      { locationId: activeLocationId, openingBalance: value },
      {
        onSuccess: () => setOpeningBalanceInput(''),
      }
    )
  }

  const handleCloseSession = () => {
    const value = Number(closingBalanceInput)
    if (!openSession || Number.isNaN(value)) return
    closeSessionMutation.mutate(
      {
        sessionId: openSession.id,
        locationId: openSession.locationId,
        closingBalance: value,
        dailyRevenue: sessionRevenue,
      },
      {
        onSuccess: () => {
          setClosingBalanceInput('')
          setShowHistory(false)
        },
      }
    )
  }

  const handleCancelSale = (movementId: string) => {
    if (!canCancelSales) return
    const sale = sessionSales.find((s) => s.id === movementId)
    if (!sale) return
    if (!confirm('Annuler cette vente ?')) return
    void cancelSale(
      sale.referenceId ? { receiptId: sale.referenceId } : { movementId: sale.id }
    ).then(() => {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    })
  }

  const startScanner = async () => {
    setScannerOpen(true)
    setScannerError(null)
    setScannerStarting(true)
    try {
      const cameras = await Html5Qrcode.getCameras()
      if (cameras.length === 0) {
        throw new Error('Aucune caméra détectée sur cet appareil.')
      }
      setScannerCameras(cameras)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible d accéder à la caméra'
      setScannerError(message)
      setScannerStarting(false)
    }
  }

  const stopScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
      }
    } catch {
      // ignore cleanup errors
    }
    scannerRef.current = null
    setScannerOpen(false)
    setScannerError(null)
    setScannerStarting(false)
    setScannerCameras([])
  }

  useEffect(() => {
    if (!scannerOpen || !scannerContainerRef.current || scannerCameras.length === 0) return
    if (scannerRef.current) return

    let cancelled = false
    const cameraId = scannerCameras[0]?.id
    if (!cameraId) return

    scannerRef.current = new Html5Qrcode(scannerContainerId)
    scannerRef.current
      .start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          const matched = availableProducts.find((p) => p.barcode === decodedText)
          if (matched) {
            addToCart(matched)
            void stopScanner()
          } else {
            setScannerError(`Code-barre non reconnu : ${decodedText}`)
          }
        },
        () => {
          // ignore per-frame scan errors / no code found
        }
      )
      .then(() => {
        if (!cancelled) setScannerStarting(false)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setScannerError(err instanceof Error ? err.message : 'Impossible de démarrer la caméra.')
          setScannerStarting(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [scannerOpen, scannerCameras, scannerContainerId, availableProducts, addToCart])

  useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [])

  const handleFileScan = async (file: File) => {
    setScannerError(null)
    const reader = new Html5Qrcode('file-scanner-temp')
    try {
      const decodedText = await reader.scanFile(file, true)
      const matched = availableProducts.find((p) => p.barcode === decodedText)
      if (matched) {
        addToCart(matched)
      } else {
        setScannerError(`Code-barre non reconnu : ${decodedText}`)
      }
    } catch {
      setScannerError('Aucun code-barre détecté sur cette image.')
    } finally {
      try {
        await reader.stop()
      } catch {
        // cleanup
      }
    }
  }

  if (!session?.organization.hasCashierEnabled) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold">Caisse</h1>
        <p className="text-muted-foreground">
          La caisse n est pas activée pour cette organisation. Contactez un administrateur.
        </p>
      </div>
    )
  }

  if (productsLoading || locationsLoading || stockLoading || movementsLoading || sessionLoading) {
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
          <p className="text-muted-foreground">Ventes rapides pour {session.organization.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} article(s)
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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

          <div className="space-y-1">
            <Label htmlFor="search">Recherche produit</Label>
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom ou code-barre…"
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Scanner un code-barre"
                aria-label="Scanner un code-barre"
                onClick={() => (scannerOpen ? stopScanner() : startScanner())}
              >
                <ScanBarcode className="h-4 w-4" />
              </Button>
            </div>
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

        {scannerOpen && (
          <div className="mt-4 rounded-lg border p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Scanner</span>
              <button type="button" onClick={() => void stopScanner()}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            {scannerError ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">{scannerError}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void startScanner()}
                    disabled={scannerStarting}
                  >
                    <ScanBarcode className="mr-2 h-4 w-4" />
                    Réessayer la caméra
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Utiliser une image
                  </Button>
                </div>
              </div>
            ) : (
              <div id={scannerContainerId} ref={scannerContainerRef} className="w-full rounded" />
            )}
            {scannerStarting && !scannerError && (
              <p className="text-sm text-muted-foreground">Démarrage de la caméra…</p>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              void handleFileScan(file)
            }
            e.currentTarget.value = ''
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          {openSession ? (
            <>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Caisse ouverte</p>
                    <p className="font-medium">
                      Solde d'ouverture : {formatCurrency(openSession.openingBalance)}
                    </p>
                    <p className="font-medium">
                      Recette en cours : {formatCurrency(sessionRevenue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(openSession.openedAt)}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setShowHistory((prev) => !prev)}
                    >
                      <History className="mr-2 h-4 w-4" />
                      {showHistory ? 'Masquer' : 'Historique'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <span className="mb-2 block text-sm font-medium">Produits disponibles</span>
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun produit ne correspond à cette recherche.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {filteredProducts.map((product) => (
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
            </>
          ) : (
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <Unlock className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-2">
                  <h2 className="font-semibold">Ouvrir la caisse</h2>
                  <p className="text-sm text-muted-foreground">
                    Aucune caisse n'est ouverte pour cet emplacement. Saisissez le solde d'ouverture
                    pour commencer.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="Solde d'ouverture"
                      value={openingBalanceInput}
                      onChange={(e) => setOpeningBalanceInput(e.target.value)}
                    />
                    <Button
                      type="button"
                      onClick={handleOpenSession}
                      disabled={
                        !activeLocationId ||
                        openingBalanceInput === '' ||
                        openSessionMutation.isPending
                      }
                    >
                      {openSessionMutation.isPending ? 'Ouverture…' : 'Ouvrir'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showHistory && (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Historique des ventes</h2>
                <button type="button" onClick={() => setShowHistory(false)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              {sessionSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune vente sur cette session.</p>
              ) : (
                <ul className="space-y-2">
                  {sessionSales.map((sale) => (
                    <li
                      key={sale.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{getSaleProductName(sale)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(sale.createdAt)} — {sale.quantity} x{' '}
                          {formatCurrency(sale.unitPrice ?? 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">
                          {formatCurrency((sale.unitPrice ?? 0) * sale.quantity)}
                        </span>
                        {canCancelSales && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleCancelSale(sale.id)}
                          >
                            Annuler
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
                        size="icon"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Label htmlFor={`price-${item.id}`} className="text-xs text-muted-foreground">
                        Prix unit.
                      </Label>
                      <Input
                        id={`price-${item.id}`}
                        type="number"
                        inputMode="decimal"
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

            <div className="mt-4 space-y-3 border-t pt-4">
              <div className="space-y-1">
                <Label htmlFor="payment-method">Mode de paiement</Label>
                <Select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value as 'cash' | 'card' | 'mobile_money' | 'transfer' | 'other'
                    )
                  }
                >
                  <option value="cash">Espèces</option>
                  <option value="card">Carte bancaire</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="transfer">Virement</option>
                  <option value="other">Autre</option>
                </Select>
              </div>

              {paymentMethod === 'cash' && (
                <div className="space-y-1">
                  <Label htmlFor="amount-paid">Montant reçu</Label>
                  <Input
                    id="amount-paid"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={`Minimum ${formatCurrency(total)}`}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="note">Note</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Référence, remise…"
                />
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {session.organization.taxName ?? 'Taxe'} ({taxRate}%)
                    </span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {paymentMethod === 'cash' && Number(amountPaid) >= total && (
                  <div className="flex items-center justify-between text-green-600">
                    <span>Monnaie</span>
                    <span>{formatCurrency(Number(amountPaid) - total)}</span>
                  </div>
                )}
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={
                  cart.length === 0 ||
                  isCheckingOut ||
                  !openSession ||
                  (paymentMethod === 'cash' && Number(amountPaid) < total)
                }
                onClick={handleCheckout}
              >
                {isCheckingOut ? 'Enregistrement…' : 'Valider la vente'}
              </Button>
              {!openSession && (
                <p className="text-center text-xs text-destructive">
                  Ouvrez une caisse pour valider une vente.
                </p>
              )}
              {success && !showReceipt && (
                <p className="text-center text-sm text-green-600">Vente enregistrée.</p>
              )}
            </div>
          </div>

          {openSession && (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div className="w-full space-y-2">
                  <h2 className="font-semibold">Clôturer la caisse</h2>
                  <p className="text-sm text-muted-foreground">
                    Solde théorique : {formatCurrency(openSession.openingBalance + sessionRevenue)}
                  </p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="Solde de clôture"
                    value={closingBalanceInput}
                    onChange={(e) => setClosingBalanceInput(e.target.value)}
                  />
                  {closingBalanceInput !== '' && (
                    <p className="text-sm">
                      Écart :{' '}
                      {formatCurrency(
                        Number(closingBalanceInput) - (openSession.openingBalance + sessionRevenue)
                      )}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={closingBalanceInput === '' || closeSessionMutation.isPending}
                    onClick={handleCloseSession}
                  >
                    {closeSessionMutation.isPending ? 'Clôture…' : 'Clôturer'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showReceipt && receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <ReceiptActions
              receipt={receipt}
              orgName={session.organization.name}
              onClose={() => {
                setShowReceipt(false)
                setReceipt(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
