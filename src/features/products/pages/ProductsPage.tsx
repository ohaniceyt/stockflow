import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProductForm } from '../components/ProductForm'
import { ProductList } from '../components/ProductList'
import { CategoryList } from '../components/CategoryList'
import { CategoryForm } from '../components/CategoryForm'
import { BulkProductImport } from '../components/BulkProductImport'
import { useCreateProduct, useProducts, useUpdateProduct } from '../hooks/useProducts'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../hooks/useCategories'
import { useAuth } from '@/features/auth/context/AuthContext'
import type { Product } from '@/types'
import type { ProductFormData } from '../schemas/productSchema'
import type { Category } from '@/types'

type TabValue = 'products' | 'categories'

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const orgId = session?.membership.orgId
  const [activeTab, setActiveTab] = useState<TabValue>('products')

  const { data: products, isLoading, error } = useProducts()
  const {
    data: categories,
    isLoading: isCategoriesLoading,
    error: categoriesError,
  } = useCategories()
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)

  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)

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
          setIsProductDialogOpen(false)
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
          setIsProductDialogOpen(false)
        },
      }
    )
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setIsProductDialogOpen(true)
  }

  const handleToggleActive = (product: Product) => {
    update.mutate({ id: product.id, isActive: !product.isActive })
  }

  const handleProductDialogOpenChange = (open: boolean) => {
    setIsProductDialogOpen(open)
    if (!open) setEditingProduct(null)
  }

  const handleCreateCategory = async (name: string) => {
    await createCategory.mutateAsync(name)
    setIsCategoryDialogOpen(false)
  }

  const handleUpdateCategory = (name: string) => {
    if (!editingCategory) return
    updateCategory.mutate(
      { id: editingCategory.id, name },
      {
        onSuccess: () => {
          setEditingCategory(null)
          setIsCategoryDialogOpen(false)
        },
      }
    )
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setIsCategoryDialogOpen(true)
  }

  const handleDeleteCategory = (category: Category) => {
    if (confirm(`Supprimer la catégorie « ${category.name} » ?`)) {
      deleteCategory.mutate(category.id)
    }
  }

  const handleCategoryDialogOpenChange = (open: boolean) => {
    setIsCategoryDialogOpen(open)
    if (!open) setEditingCategory(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produits</h1>
          <p className="text-muted-foreground">
            Gérez le catalogue de produits et les catégories de votre organisation.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
        <TabsList>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {orgId && (
              <BulkProductImport
                orgId={orgId}
                onSuccess={() => {
                  void queryClient.invalidateQueries({ queryKey: ['products', orgId] })
                  void queryClient.invalidateQueries({ queryKey: ['categories', orgId] })
                }}
              />
            )}
            <Dialog open={isProductDialogOpen} onOpenChange={handleProductDialogOpenChange}>
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  setEditingProduct(null)
                  setIsProductDialogOpen(true)
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
                  categories={categories ?? []}
                  onSubmit={editingProduct ? handleUpdate : handleCreate}
                  onCancel={() => handleProductDialogOpenChange(false)}
                  onCreateCategory={handleCreateCategory}
                  isLoading={create.isPending || update.isPending}
                  isCreatingCategory={createCategory.isPending}
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
        </TabsContent>

        <TabsContent value="categories">
          <div className="flex justify-end">
            <Dialog open={isCategoryDialogOpen} onOpenChange={handleCategoryDialogOpenChange}>
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  setEditingCategory(null)
                  setIsCategoryDialogOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle catégorie
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCategory
                      ? 'Modifiez le nom de la catégorie ci-dessous.'
                      : 'Créez une catégorie pour classer vos produits.'}
                  </DialogDescription>
                </DialogHeader>
                <CategoryForm
                  category={editingCategory}
                  onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory}
                  onCancel={() => handleCategoryDialogOpenChange(false)}
                  isLoading={
                    createCategory.isPending || updateCategory.isPending || deleteCategory.isPending
                  }
                />
                {(createCategory.error ?? updateCategory.error ?? deleteCategory.error) && (
                  <p className="text-sm text-destructive">
                    {
                      (createCategory.error ?? updateCategory.error ?? deleteCategory.error)
                        ?.message
                    }
                  </p>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {isCategoriesLoading && (
            <p className="text-muted-foreground">Chargement des catégories…</p>
          )}
          {categoriesError && <p className="text-destructive">{categoriesError.message}</p>}
          {!isCategoriesLoading && !categoriesError && categories && (
            <CategoryList
              categories={categories}
              onEdit={handleEditCategory}
              onDelete={handleDeleteCategory}
              isUpdating={updateCategory.isPending || deleteCategory.isPending}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
