import { useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { ScanBarcode } from 'lucide-react'
import { productSchema, type ProductFormData } from '../schemas/productSchema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ProductCategorySelect } from './ProductCategorySelect'
import { ScannerDialog } from '@/features/cashier/components/ScannerDialog'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import type { Product, Category } from '@/types'

interface ProductFormProps {
  product?: Product | null
  categories: Category[]
  onSubmit: (data: ProductFormData) => void
  onCancel: () => void
  onCreateCategory: (name: string) => Promise<string>
  isLoading?: boolean
  isCreatingCategory?: boolean
  error?: Error | null
}

function sanitizeNumber(value: string): number {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
}

function resolveInitialCategoryId(
  product: Product | null | undefined,
  categories: Category[]
): string | null {
  const value = product?.category ?? null
  if (!value) return null
  if (categories.some((c) => c.id === value)) return value
  const byName = categories.find((c) => c.name.trim().toLowerCase() === value.trim().toLowerCase())
  return byName?.id ?? null
}

function resolveCategoryValue(
  value: string | null | undefined,
  categories: Category[]
): string | null {
  if (!value) return null
  const byId = categories.find((c) => c.id === value)
  return byId?.name ?? value
}

export function ProductForm({
  product,
  categories,
  onSubmit,
  onCancel,
  onCreateCategory,
  isLoading,
  isCreatingCategory,
  error,
}: ProductFormProps) {
  const initialCategoryId = useMemo(
    () => resolveInitialCategoryId(product ?? null, categories),
    [product, categories]
  )
  const [form, setForm] = useState<ProductFormData>({
    name: product?.name ?? '',
    category: initialCategoryId ?? '',
    unit: product?.unit ?? 'unité',
    threshold: product?.threshold ?? 0,
    costPrice: product?.costPrice ?? 0,
    sellingPrice: product?.sellingPrice ?? 0,
    supplier: product?.supplier ?? '',
    description: product?.description ?? '',
    barcode: product?.barcode ?? '',
    isActive: product?.isActive ?? true,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({})
  const [scannerErrorOverride, setScannerErrorOverride] = useState<string | null>(null)
  const disabled = Boolean(isLoading) || Boolean(isCreatingCategory)
  const scannerContainerId = useMemo(() => `product-scanner-${crypto.randomUUID()}`, [])
  const scannerContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleScannerMatch = (barcode: string) => {
    updateField('barcode', barcode)
  }

  const handleScannerNoMatch = () => {
    // In product creation any barcode is valid, even if not in catalog.
  }

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
    availableProducts: [],
    onMatch: handleScannerMatch,
    onNoMatch: handleScannerNoMatch,
  })

  const displayedScannerError = scannerErrorOverride ?? scannerError

  const handleScannerClose = async () => {
    setScannerErrorOverride(null)
    await stopScanner()
  }

  const handleFileScan = async (file: File) => {
    setScannerErrorOverride(null)
    await scanFile(file)
  }

  const updateField = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const result = productSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ProductFormData, string>> = {}
      result.error.errors.forEach((err) => {
        const key = err.path[0] as keyof ProductFormData
        fieldErrors[key] ??= err.message
      })
      setErrors(fieldErrors)
      return
    }
    const data = {
      ...result.data,
      category: resolveCategoryValue(result.data.category, categories),
    }
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom du produit *</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Ex: Ciment 50kg"
          disabled={disabled}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProductCategorySelect
          id="category"
          value={form.category ?? ''}
          onChange={(value) => updateField('category', value)}
          categories={categories}
          onCreateCategory={onCreateCategory}
          isCreating={isCreatingCategory}
          disabled={disabled}
        />
        <div className="space-y-2">
          <Label htmlFor="unit">Unité *</Label>
          <Input
            id="unit"
            value={form.unit}
            onChange={(e) => updateField('unit', e.target.value)}
            placeholder="Ex: sac"
            disabled={disabled}
          />
          {errors.unit && <p className="text-sm text-destructive">{errors.unit}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="threshold">Seuil d'alerte</Label>
          <Input
            id="threshold"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.threshold}
            onChange={(e) => updateField('threshold', sanitizeNumber(e.target.value))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="costPrice">Prix d'achat</Label>
          <Input
            id="costPrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.costPrice}
            onChange={(e) => updateField('costPrice', sanitizeNumber(e.target.value))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sellingPrice">Prix de vente</Label>
          <Input
            id="sellingPrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.sellingPrice}
            onChange={(e) => updateField('sellingPrice', sanitizeNumber(e.target.value))}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="supplier">Fournisseur</Label>
          <Input
            id="supplier"
            value={form.supplier ?? ''}
            onChange={(e) => updateField('supplier', e.target.value || null)}
            placeholder="Ex: CIMTOGO"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="barcode">Code-barres</Label>
          <div className="flex items-center gap-2">
            <Input
              id="barcode"
              value={form.barcode ?? ''}
              onChange={(e) => updateField('barcode', e.target.value || null)}
              placeholder="Ex: 123456789"
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Scanner un code-barre"
              aria-label="Scanner un code-barre"
              onClick={startScanner}
              disabled={disabled}
            >
              <ScanBarcode className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description ?? ''}
          onChange={(e) => updateField('description', e.target.value || null)}
          placeholder="Notes sur le produit"
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="isActive">Statut</Label>
        <Select
          id="isActive"
          value={form.isActive ? 'true' : 'false'}
          onChange={(e) => updateField('isActive', e.target.value === 'true')}
          disabled={disabled}
        >
          <option value="true">Actif</option>
          <option value="false">Inactif</option>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      <ScannerDialog
        open={scannerOpen}
        onClose={handleScannerClose}
        starting={scannerStarting}
        error={displayedScannerError}
        cameras={scannerCameras}
        selectedCameraId={selectedCameraId}
        containerId={scannerContainerId}
        containerRef={scannerContainerRef}
        onRetryCamera={retryScanner}
        onFileSelect={() => fileInputRef.current?.click()}
        onCameraChange={setSelectedCameraId}
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

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Enregistrement…' : product ? 'Mettre à jour' : 'Créer'}
        </Button>
      </div>
    </form>
  )
}
