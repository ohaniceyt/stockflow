import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil, Power, PowerOff } from 'lucide-react'
import { useAuth } from '@/features/auth/context/AuthContext'
import type { Product } from '@/types'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'
import { StatusBadge, EmptyState } from '@/components/design-system'
import { Package } from 'lucide-react'

interface ProductListProps {
  products: Product[]
  onEdit: (product: Product) => void
  onToggleActive: (product: Product) => void
  isUpdating?: boolean
  canManage?: boolean
}

export function ProductList({
  products,
  onEdit,
  onToggleActive,
  isUpdating,
  canManage = true,
}: ProductListProps) {
  const { session } = useAuth()
  const currency = session?.organization.currency ?? 'XOF'
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }),
    [currency]
  )

  const formatPrice = (amount: number) => {
    try {
      return currencyFormatter.format(amount)
    } catch {
      return `${amount.toLocaleString('fr-FR')} ${currency}`
    }
  }

  const columns: ResponsiveColumn<Product>[] = [
    {
      key: 'name',
      header: 'Nom',
      cell: (product) => product.name,
      className: 'font-medium',
    },
    { key: 'category', header: 'Catégorie', cell: (product) => product.category ?? '—' },
    { key: 'unit', header: 'Unité', cell: (product) => product.unit },
    { key: 'threshold', header: 'Seuil', cell: (product) => product.threshold.toLocaleString() },
    {
      key: 'costPrice',
      header: "Prix d'achat",
      cell: (product) => formatPrice(product.costPrice),
    },
    {
      key: 'sellingPrice',
      header: 'Prix de vente',
      cell: (product) => formatPrice(product.sellingPrice),
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (product) =>
        product.isActive ? (
          <StatusBadge variant="success">Actif</StatusBadge>
        ) : (
          <StatusBadge variant="neutral">Inactif</StatusBadge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (product) =>
        canManage ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(product)}
              disabled={isUpdating}
              aria-label={`Modifier ${product.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleActive(product)}
              disabled={isUpdating}
              aria-label={
                product.isActive ? `Désactiver ${product.name}` : `Activer ${product.name}`
              }
            >
              {product.isActive ? (
                <PowerOff className="h-4 w-4 text-destructive" />
              ) : (
                <Power className="h-4 w-4 text-emerald-600" />
              )}
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <ResponsiveTable
      data={products}
      columns={columns}
      keyExtractor={(product) => product.id}
      empty={
        <EmptyState
          icon={Package}
          title="Aucun produit"
          description="Créez votre premier produit pour commencer."
        />
      }
      mobileCardTitle={(product) => (
        <span>
          {product.name}{' '}
          <span className="text-sm font-normal text-muted-foreground">({product.unit})</span>
        </span>
      )}
    />
  )
}
