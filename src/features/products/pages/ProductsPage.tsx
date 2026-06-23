import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProductForm } from '../components/ProductForm'
import { ProductList } from '../components/ProductList'
import { useCreateProduct, useProducts, useUpdateProduct } from '../hooks/useProducts'
import type { Product } from '@/types'
import type { ProductFormData } from '../schemas/productSchema'

export default function ProductsPage() {
  const { data: products, isLoading, error } = useProducts()
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleCreate = (data: ProductFormData) => {
    create.mutate(
      {
        name: data.name,
        category: data.category ?? null,
        unit: data.unit,
        threshold: data.threshold,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        supplier: data.supplier ?? null,
        description: data.description ?? null,
        barcode: data.barcode ?? null,
        isActive: data.isActive,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false)
        },
      }
    )
  }

  const handleUpdate = (data: ProductFormData) => {
    if (!editingProduct) return
    update.mutate(
      {
        id: editingProduct.id,
        name: data.name,
        category: data.category ?? null,
        unit: data.unit,
        threshold: data.threshold,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        supplier: data.supplier ?? null,
        description: data.description ?? null,
        barcode: data.barcode ?? null,
        isActive: data.isActive,
      },
      {
        onSuccess: () => {
          setEditingProduct(null)
          setIsDialogOpen(false)
        },
      }
    )
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setIsDialogOpen(true)
  }

  const handleToggleActive = (product: Product) => {
    update.mutate({ id: product.id, isActive: !product.isActive })
  }

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) setEditingProduct(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produits</h1>
          <p className="text-muted-foreground">
            Gérez le catalogue de produits de votre organisation.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setEditingProduct(null)
              setIsDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau produit
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? 'Modifiez les informations du produit ci-dessous.'
                  : 'Remplissez les informations pour créer un nouveau produit.'}
              </DialogDescription>
            </DialogHeader>
            <ProductForm
              product={editingProduct}
              onSubmit={editingProduct ? handleUpdate : handleCreate}
              onCancel={() => handleOpenChange(false)}
              isLoading={create.isPending || update.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement des produits…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {!isLoading && !error && products && (
        <ProductList
          products={products}
          onEdit={handleEdit}
          onToggleActive={handleToggleActive}
          isUpdating={update.isPending}
        />
      )}
    </div>
  )
}
