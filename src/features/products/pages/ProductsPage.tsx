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
  CATEGORIES_QUERY_KEY,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../hooks/useCategories'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import type { Product } from '@/types'
import type { ProductFormData } from '../schemas/productSchema'
import type { Category } from '@/types'

type TabValue = 'products' | 'categories'

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const { session, hasRole } = useAuth()
  const online = useNetworkStatus()
  const orgId = session?.membership.orgId
  const [activeTab, setActiveTab] = useState<TabValue>('products')

  const canManage = hasRole(['super_admin', 'admin', 'operator'])
  const canBulkImport = hasRole(['super_admin', 'admin'])

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
  const [productFormError, setProductFormError] = useState<string | null>(null)
  const [productFormInfo, setProductFormInfo] = useState<string | null>(null)

  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  const handleCreate = (data: ProductFormData) => {
    setProductFormError(null)
    setProductFormInfo(null)
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
        onSuccess: (result) => {
          if (result.queued) {
            setProductFormInfo('Enregistré hors ligne, sera synchronisé.')
            return
          }
          setIsProductDialogOpen(false)
        },
        onError: (err) => {
          setProductFormError(err.message)
        },
      }
    )
  }

  const handleUpdate = (data: ProductFormData) => {
    if (!editingProduct) return
    setProductFormError(null)
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
        onError: (err) => {
          setProductFormError(err.message)
        },
      }
    )
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setIsProductDialogOpen(true)
  }

  const handleToggleActive = (product: Product) => {
    setProductFormError(null)
    update.mutate(
      { id: product.id, isActive: !product.isActive },
      {
        onError: (err) => {
          setProductFormError(err.message)
        },
      }
    )
  }

  const handleProductDialogOpenChange = (open: boolean) => {
    setIsProductDialogOpen(open)
    setProductFormError(null)
    setProductFormInfo(null)
    if (!open) setEditingProduct(null)
  }

  const handleCreateCategory = async (name: string) => {
    const created = await createCategory.mutateAsync(name)
    if (orgId) {
      await queryClient.refetchQueries({ queryKey: [CATEGORIES_QUERY_KEY, orgId], exact: true })
    }
    setIsCategoryDialogOpen(false)
    return created.id
  }

  const handleUpdateCategory = (name: string) => {
    if (!editingCategory) return
    setCategoryError(null)
    updateCategory.mutate(
      { id: editingCategory.id, name },
      {
        onSuccess: () => {
          setEditingCategory(null)
          setIsCategoryDialogOpen(false)
        },
        onError: (err) => {
          setCategoryError(err.message)
        },
      }
    )
  }

  const handleEditCategory = (category: Category) => {
    setCategoryError(null)
    setEditingCategory(category)
    setIsCategoryDialogOpen(true)
  }

  const handleDeleteCategory = (category: Category) => {
    if (confirm(`Supprimer la catégorie « ${category.name} » ?`)) {
      setCategoryError(null)
      deleteCategory.mutate(category.id, {
        onError: (err) => {
          setCategoryError(err.message)
        },
      })
    }
  }

  const handleCategoryDialogOpenChange = (open: boolean) => {
    setIsCategoryDialogOpen(open)
    setCategoryError(null)
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

      {productFormError && (
        <p className="rounded-lg border border-[var(--rose)] bg-[var(--rose-light)] p-3 text-sm text-[var(--rose)]">
          {productFormError}
        </p>
      )}
      {productFormInfo && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {productFormInfo}
        </p>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
        <TabsList>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {orgId && canBulkImport && (
              <BulkProductImport
                orgId={orgId}
                onSuccess={() => {
                  void queryClient.invalidateQueries({ queryKey: ['products', orgId] })
                  void queryClient.invalidateQueries({ queryKey: ['categories', orgId] })
                }}
                disabled={!online}
              />
            )}
            {canManage && (
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
                    key={editingProduct?.id ?? 'new'}
                    product={editingProduct}
                    categories={categories ?? []}
                    onSubmit={editingProduct ? handleUpdate : handleCreate}
                    onCancel={() => handleProductDialogOpenChange(false)}
                    onCreateCategory={handleCreateCategory}
                    isLoading={create.isPending || update.isPending}
                    isCreatingCategory={createCategory.isPending}
                    error={
                      productFormError
                        ? new Error(productFormError)
                        : (create.error ?? update.error)
                    }
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>

          {isLoading && <p className="text-muted-foreground">Chargement des produits…</p>}
          {error && <p className="text-destructive">{error.message}</p>}
          {!isLoading && !error && products && (
            <ProductList
              products={products}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
              isUpdating={update.isPending}
              canManage={canManage}
            />
          )}
        </TabsContent>

        <TabsContent value="categories">
          <div className="flex justify-end">
            {canManage && (
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
                      createCategory.isPending ||
                      updateCategory.isPending ||
                      deleteCategory.isPending
                    }
                  />
                  {(categoryError ??
                    createCategory.error ??
                    updateCategory.error ??
                    deleteCategory.error) && (
                    <p className="text-sm text-destructive">
                      {categoryError ??
                        (createCategory.error ?? updateCategory.error ?? deleteCategory.error)
                          ?.message}
                    </p>
                  )}
                </DialogContent>
              </Dialog>
            )}
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
              canManage={canManage}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
