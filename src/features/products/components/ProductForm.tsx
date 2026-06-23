import { useState, type SyntheticEvent } from 'react'
import { productSchema, type ProductFormData } from '../schemas/productSchema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { Product } from '@/types'

interface ProductFormProps {
  product?: Product | null
  onSubmit: (data: ProductFormData) => void
  onCancel: () => void
  isLoading?: boolean
}

export function ProductForm({ product, onSubmit, onCancel, isLoading }: ProductFormProps) {
  const [form, setForm] = useState<ProductFormData>({
    name: product?.name ?? '',
    category: product?.category ?? '',
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
    onSubmit(result.data)
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
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Catégorie</Label>
          <Input
            id="category"
            value={form.category ?? ''}
            onChange={(e) => updateField('category', e.target.value || null)}
            placeholder="Ex: Matériaux"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unité *</Label>
          <Input
            id="unit"
            value={form.unit}
            onChange={(e) => updateField('unit', e.target.value)}
            placeholder="Ex: sac"
          />
          {errors.unit && <p className="text-xs text-destructive">{errors.unit}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="threshold">Seuil d'alerte</Label>
          <Input
            id="threshold"
            type="number"
            min={0}
            value={form.threshold}
            onChange={(e) => updateField('threshold', Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="costPrice">Prix d'achat</Label>
          <Input
            id="costPrice"
            type="number"
            min={0}
            step="0.01"
            value={form.costPrice}
            onChange={(e) => updateField('costPrice', Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sellingPrice">Prix de vente</Label>
          <Input
            id="sellingPrice"
            type="number"
            min={0}
            step="0.01"
            value={form.sellingPrice}
            onChange={(e) => updateField('sellingPrice', Number(e.target.value))}
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="barcode">Code-barres</Label>
          <Input
            id="barcode"
            value={form.barcode ?? ''}
            onChange={(e) => updateField('barcode', e.target.value || null)}
            placeholder="Ex: 123456789"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={form.description ?? ''}
          onChange={(e) => updateField('description', e.target.value || null)}
          placeholder="Notes sur le produit"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="isActive">Statut</Label>
        <Select
          id="isActive"
          value={form.isActive ? 'true' : 'false'}
          onChange={(e) => updateField('isActive', e.target.value === 'true')}
        >
          <option value="true">Actif</option>
          <option value="false">Inactif</option>
        </Select>
      </div>

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
