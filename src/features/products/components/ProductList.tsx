import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Power, PowerOff } from 'lucide-react'
import type { Product } from '@/types'

interface ProductListProps {
  products: Product[]
  onEdit: (product: Product) => void
  onToggleActive: (product: Product) => void
  isUpdating?: boolean
}

export function ProductList({ products, onEdit, onToggleActive, isUpdating }: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Aucun produit. Créez votre premier produit pour commencer.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Catégorie</TableHead>
          <TableHead>Unité</TableHead>
          <TableHead>Seuil</TableHead>
          <TableHead>Prix d'achat</TableHead>
          <TableHead>Prix de vente</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell>{product.category ?? '—'}</TableCell>
            <TableCell>{product.unit}</TableCell>
            <TableCell>{product.threshold}</TableCell>
            <TableCell>{product.costPrice.toLocaleString()}</TableCell>
            <TableCell>{product.sellingPrice.toLocaleString()}</TableCell>
            <TableCell>
              {product.isActive ? (
                <Badge variant="default">Actif</Badge>
              ) : (
                <Badge variant="secondary">Inactif</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
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
                    <Power className="h-4 w-4 text-green-600" />
                  )}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
