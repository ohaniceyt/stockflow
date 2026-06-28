import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useContacts } from '@/features/contacts/hooks/useContacts'
import { useMovements } from '@/features/movements/hooks/useMovements'
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
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import type { Product, ReceiptWithItems } from '@/types'
import type { CartItem } from '../pages/CashierPage'

interface CatalogProduct extends Product {
  locationId: string
  locationName: string
  available: number
}

export function useCashier(scannerContainerId: string) {
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
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'card' | 'mobile_money' | 'transfer' | 'other'
  >('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [receipt, setReceipt] = useState<ReceiptWithItems | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [scannerErrorOverride, setScannerErrorOverride] = useState<string | null>(null)
  const scannerContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const defaultLocation = locations?.find((l) => l.isDefault)
  const activeLocationId =
    selectedLocationId.length > 0 ? selectedLocationId : (defaultLocation?.id ?? '')
  const activeLocationName = locations?.find((l) => l.id === activeLocationId)?.name ?? ''

  const { data: openSession, isLoading: sessionLoading } = useCashierSession(activeLocationId)

  const canCancelSales = hasRole(['super_admin', 'admin'])

  const customerOptions = useMemo(() => {
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

  const handleScannerMatch = useCallback(
    (barcode: string) => {
      const matched = availableProducts.find((p) => p.barcode === barcode)
      if (matched) {
        addToCart(matched)
      }
    },
    [availableProducts, addToCart]
  )

  const handleScannerNoMatch = useCallback((barcode: string) => {
    setScannerErrorOverride(`Code-barre non reconnu : ${barcode}`)
  }, [])

  const {
    open: scannerOpen,
    starting: scannerStarting,
    error: scannerError,
    cameras: scannerCameras,
    selectedCameraId,
    start: startScanner,
    close: stopScanner,
    retry: retryScanner,
    scanFile,
    setSelectedCameraId,
  } = useBarcodeScanner({
    containerId: scannerContainerId,
    containerRef: scannerContainerRef,
    availableProducts,
    onMatch: handleScannerMatch,
    onNoMatch: handleScannerNoMatch,
  })

  const displayedScannerError = scannerErrorOverride ?? scannerError

  const handleScannerClose = useCallback(async () => {
    setScannerErrorOverride(null)
    await stopScanner()
  }, [stopScanner])

  const handleFileScan = async (file: File) => {
    setScannerErrorOverride(null)
    await scanFile(file)
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

  const isLoading =
    productsLoading || locationsLoading || stockLoading || movementsLoading || sessionLoading

  return {
    session,
    isLoading,
    hasCashierEnabled: session?.organization.hasCashierEnabled ?? false,
    locations,
    activeLocationId,
    activeLocationName,
    customerId,
    setCustomerId,
    customerOptions,
    selectedLocationId,
    setSelectedLocationId,
    search,
    setSearch,
    filteredProducts,
    addToCart,
    cart,
    updateQuantity,
    updatePrice,
    removeItem,
    subtotal,
    taxRate,
    taxAmount,
    total,
    paymentMethod,
    setPaymentMethod,
    amountPaid,
    setAmountPaid,
    note,
    setNote,
    isCheckingOut,
    success,
    handleCheckout,
    openSession,
    sessionRevenue,
    openingBalanceInput,
    setOpeningBalanceInput,
    closingBalanceInput,
    setClosingBalanceInput,
    handleOpenSession,
    handleCloseSession,
    openSessionMutation,
    closeSessionMutation,
    sessionSales,
    getSaleProductName,
    handleCancelSale,
    canCancelSales,
    receipt,
    showReceipt,
    setShowReceipt,
    setReceipt,
    scanner: {
      open: scannerOpen,
      starting: scannerStarting,
      error: displayedScannerError,
      cameras: scannerCameras,
      selectedCameraId,
      containerId: scannerContainerId,
      containerRef: scannerContainerRef,
      start: startScanner,
      close: handleScannerClose,
      retry: retryScanner,
      scanFile: handleFileScan,
      setSelectedCameraId,
      fileInputRef,
    },
  }
}
