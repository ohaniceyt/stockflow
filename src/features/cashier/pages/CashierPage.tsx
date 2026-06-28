import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { CashierHeader } from '../components/CashierHeader'
import { ProductCatalog } from '../components/ProductCatalog'
import { CartPanel } from '../components/CartPanel'
import { SessionDrawer } from '../components/SessionDrawer'
import { ScannerDialog } from '../components/ScannerDialog'
import type { Product, ReceiptWithItems } from '@/types'

export interface CartItem {
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

interface CatalogProduct extends Product {
  locationId: string
  locationName: string
  available: number
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
  const [cart, setCart] = useState<CartItem[]>([])
  const [note, setNote] = useState('')
  const [success, setSuccess] = useState(false)
  const [search, setSearch] = useState('')
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
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState('products')
  const scannerContainerId = useMemo(() => `cashier-scanner-${crypto.randomUUID()}`, [])
  const scannerContainerRef = useRef<HTMLDivElement | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const defaultLocation = locations?.find((l) => l.isDefault)
  const activeLocationId =
    selectedLocationId.length > 0 ? selectedLocationId : (defaultLocation?.id ?? '')
  const activeLocationName = locations?.find((l) => l.id === activeLocationId)?.name ?? ''

  const { data: openSession, isLoading: sessionLoading } = useCashierSession(activeLocationId)

  const canCancelSales = hasRole(['super_admin', 'admin'])

  const customerOptions: CustomerOption[] = useMemo(() => {
    const base =
      customers?.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name })) ?? []
    return [{ id: 'walk-in', label: 'Client de passage' }, ...base]
  }, [customers])

  const availableProducts: CatalogProduct[] = useMemo(() => {
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
    (product: CatalogProduct) => {
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
      const message = err instanceof Error ? err.message : "Impossible d'accéder à la caméra"
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
        void stopScanner()
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
          La caisse n'est pas activée pour cette organisation. Contactez un administrateur.
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
    <div className="mx-auto max-w-6xl space-y-4 pb-6">
      <CashierHeader
        orgName={session.organization.name}
        locationName={activeLocationName}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onOpenSession={() => setSessionDrawerOpen(true)}
      />

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div className="space-y-1">
            <Label htmlFor="location" className="text-xs">
              Emplacement
            </Label>
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
            <Label htmlFor="customer" className="text-xs">
              Client
            </Label>
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

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {openSession ? (
            <span>
              Caisse ouverte — recette : <strong>{formatCurrency(sessionRevenue)}</strong>
            </span>
          ) : (
            <span className="text-destructive">Caisse fermée</span>
          )}
        </div>
      </div>

      {/* Desktop split view */}
      <div className="hidden gap-4 md:grid md:grid-cols-5">
        <div className="md:col-span-3">
          <ProductCatalog
            search={search}
            onSearchChange={setSearch}
            products={filteredProducts}
            onAdd={addToCart}
            onStartScanner={startScanner}
            formatCurrency={formatCurrency}
          />
        </div>
        <div className="md:col-span-2">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <CartPanel
              cart={cart}
              paymentMethod={paymentMethod}
              amountPaid={amountPaid}
              note={note}
              subtotal={subtotal}
              taxAmount={taxAmount}
              total={total}
              taxRate={taxRate}
              taxName={session.organization.taxName}
              isCheckingOut={isCheckingOut}
              openSession={!!openSession}
              success={success}
              onPaymentMethodChange={setPaymentMethod}
              onAmountPaidChange={setAmountPaid}
              onNoteChange={setNote}
              onUpdateQuantity={updateQuantity}
              onUpdatePrice={updatePrice}
              onRemove={removeItem}
              onCheckout={handleCheckout}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products">Produits</TabsTrigger>
            <TabsTrigger value="cart">
              Panier ({cart.reduce((sum, item) => sum + item.quantity, 0)})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="mt-4">
            <ProductCatalog
              search={search}
              onSearchChange={setSearch}
              products={filteredProducts}
              onAdd={(product) => {
                addToCart(product)
                setMobileTab('cart')
              }}
              onStartScanner={startScanner}
              formatCurrency={formatCurrency}
            />
          </TabsContent>
          <TabsContent value="cart" className="mt-4">
            <CartPanel
              cart={cart}
              paymentMethod={paymentMethod}
              amountPaid={amountPaid}
              note={note}
              subtotal={subtotal}
              taxAmount={taxAmount}
              total={total}
              taxRate={taxRate}
              taxName={session.organization.taxName}
              isCheckingOut={isCheckingOut}
              openSession={!!openSession}
              success={success}
              onPaymentMethodChange={setPaymentMethod}
              onAmountPaidChange={setAmountPaid}
              onNoteChange={setNote}
              onUpdateQuantity={updateQuantity}
              onUpdatePrice={updatePrice}
              onRemove={removeItem}
              onCheckout={handleCheckout}
              formatCurrency={formatCurrency}
            />
          </TabsContent>
        </Tabs>
      </div>

      <SessionDrawer
        open={sessionDrawerOpen}
        onClose={() => setSessionDrawerOpen(false)}
        openSession={openSession ?? null}
        sessionRevenue={sessionRevenue}
        sessionSales={sessionSales.map((sale) => ({
          id: sale.id,
          createdAt: sale.createdAt,
          quantity: sale.quantity,
          unitPrice: sale.unitPrice ?? 0,
          productName: getSaleProductName(sale),
        }))}
        openingBalanceInput={openingBalanceInput}
        closingBalanceInput={closingBalanceInput}
        openingPending={openSessionMutation.isPending}
        closingPending={closeSessionMutation.isPending}
        canCancelSales={canCancelSales}
        formatCurrency={formatCurrency}
        formatDateTime={formatDateTime}
        onOpeningBalanceChange={setOpeningBalanceInput}
        onClosingBalanceChange={setClosingBalanceInput}
        onOpenSession={handleOpenSession}
        onCloseSession={handleCloseSession}
        onCancelSale={handleCancelSale}
      />

      <ScannerDialog
        open={scannerOpen}
        onClose={stopScanner}
        starting={scannerStarting}
        error={scannerError}
        containerId={scannerContainerId}
        containerRef={scannerContainerRef}
        onRetryCamera={() => {
          void stopScanner().then(() => void startScanner())
        }}
        onFileSelect={() => fileInputRef.current?.click()}
      />

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
