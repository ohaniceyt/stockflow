import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import type { Category } from '@/types'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

interface CategoryListProps {
  categories: Category[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  isUpdating?: boolean
  canManage?: boolean
}

export function CategoryList({
  categories,
  onEdit,
  onDelete,
  isUpdating,
  canManage = true,
}: CategoryListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const columns: ResponsiveColumn<Category>[] = [
    {
      key: 'name',
      header: 'Nom',
      cell: (category) => category.name,
      className: 'font-medium',
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      cell: (category) => {
        if (!canManage) return null
        const isConfirming = confirmDeleteId === category.id
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(category)}
              disabled={isUpdating}
              aria-label={`Modifier ${category.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {isConfirming ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setConfirmDeleteId(null)
                  onDelete(category)
                }}
                disabled={isUpdating}
              >
                Confirmer
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmDeleteId(category.id)}
                disabled={isUpdating}
                aria-label={`Supprimer ${category.name}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const empty = (
    <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
      Aucune catégorie. Créez votre première catégorie pour commencer.
    </div>
  )

  return (
    <ResponsiveTable
      data={categories}
      columns={columns}
      keyExtractor={(category) => category.id}
      empty={empty}
      mobileCardTitle={(category) => <span>{category.name}</span>}
    />
  )
}
