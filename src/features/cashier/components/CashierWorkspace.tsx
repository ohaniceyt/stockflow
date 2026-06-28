import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Maximize2, Minimize2, X, LogOut } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useCashier } from '../hooks/useCashier'
import { CashierHeader } from './CashierHeader'
import { ProductCatalog } from './ProductCatalog'
import { CartPanel } from './CartPanel'
import { SessionDrawer } from './SessionDrawer'
import { ScannerDialog } from './ScannerDialog'
import ReceiptActions from '@/features/invoicing/components/ReceiptActions'

interface CashierWorkspaceProps {
  embedded?: boolean
  onCloseTab?: () => void
  extraHeaderActions?: ReactNode
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

export function CashierWorkspace({
  embedded = false,
  onCloseTab,
  extraHeaderActions,
}: CashierWorkspaceProps) {
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState('products')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const scannerContainerId = useMemo(() => `cashier-workspace-scanner-${crypto.randomUUID()}`, [])

  const {
    session,
    isLoading,
    hasCashierEnabled,
    locations,
    activeLocationId,
    activeLocationName,
    customerId,
    setCustomerId,
    customerOptions,
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
    scanner,
  } = useCashier(scannerContainerId)

  const {
    open: scannerOpen,
    starting: scannerStarting,
    error: scannerError,
    cameras: scannerCameras,
    selectedCameraId,
    containerRef: scannerContainerRef,
    start: startScanner,
    close: closeScanner,
    retry: retryScanner,
    scanFile,
    setSelectedCameraId,
    fileInputRef: scannerFileInputRef,
  } = scanner

  const handleAddToCart = (product: Parameters<typeof addToCart>[0]) => {
    addToCart(product)
    setMobileTab('cart')
  }

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      // Fullscreen API may be blocked on some devices; ignore.
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  if (!hasCashierEnabled || !session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Caisse</h1>
        <p className="text-muted-foreground">
          La caisse n&apos;est pas activée pour cette organisation. Contactez un administrateur.
        </p>
        {onCloseTab && (
          <Button type="button" variant="outline" onClick={onCloseTab}>
            Fermer
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <CashierHeader
            orgName={session.organization.name}
            locationName={activeLocationName}
            cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
            onOpenSession={() => setSessionDrawerOpen(true)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
          {extraHeaderActions}
          {onCloseTab && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Fermer l'onglet"
              aria-label="Fermer l'onglet"
              onClick={onCloseTab}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
          {embedded && onCloseTab && (
            <Button type="button" variant="outline" size="sm" onClick={onCloseTab}>
              <LogOut className="mr-2 h-4 w-4" />
              Quitter
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3 border-b bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
                if (cart.length > 0) {
                  cart.forEach((item) => removeItem(item.id))
                }
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

      <main className="flex-1 overflow-hidden p-4">
        <div className="hidden h-full gap-4 md:grid md:grid-cols-5">
          <div className="h-full overflow-y-auto md:col-span-3">
            <ProductCatalog
              search={search}
              onSearchChange={setSearch}
              products={filteredProducts}
              onAdd={addToCart}
              onStartScanner={startScanner}
              formatCurrency={formatCurrency}
            />
          </div>
          <div className="h-full overflow-y-auto md:col-span-2">
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

        <div className="h-full md:hidden">
          <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex h-full flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="products">Produits</TabsTrigger>
              <TabsTrigger value="cart">
                Panier ({cart.reduce((sum, item) => sum + item.quantity, 0)})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="products" className="mt-4 flex-1 overflow-y-auto">
              <ProductCatalog
                search={search}
                onSearchChange={setSearch}
                products={filteredProducts}
                onAdd={handleAddToCart}
                onStartScanner={startScanner}
                formatCurrency={formatCurrency}
              />
            </TabsContent>
            <TabsContent value="cart" className="mt-4 flex-1 overflow-y-auto">
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
      </main>

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
        onClose={closeScanner}
        starting={scannerStarting}
        error={scannerError}
        cameras={scannerCameras}
        selectedCameraId={selectedCameraId}
        containerId={scannerContainerId}
        containerRef={scannerContainerRef}
        onRetryCamera={retryScanner}
        onFileSelect={() => scannerFileInputRef.current?.click()}
        onCameraChange={setSelectedCameraId}
      />

      <input
        ref={scannerFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            void scanFile(file)
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
