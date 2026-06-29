import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useNetworkStatus } from '@/features/offline/hooks/useSync'
import type { Category } from '@/types'

interface ProductCategorySelectProps {
  id?: string
  value: string | null
  onChange: (value: string | null) => void
  categories: Category[]
  onCreateCategory: (name: string) => Promise<string>
  isCreating?: boolean
  disabled?: boolean
}

const NEW_CATEGORY_VALUE = '__new__'
const NO_CATEGORY_VALUE = ''

function resolveCategoryId(value: string | null, categories: Category[]): string | null {
  if (!value) return null
  // Newer products store the category id directly.
  if (categories.some((c) => c.id === value)) return value
  // Legacy products store the category name as free text.
  const byName = categories.find((c) => c.name.trim().toLowerCase() === value.trim().toLowerCase())
  return byName?.id ?? null
}

export function ProductCategorySelect({
  id = 'category',
  value,
  onChange,
  categories,
  onCreateCategory,
  isCreating,
  disabled,
}: ProductCategorySelectProps) {
  const online = useNetworkStatus()
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedId = useMemo(() => resolveCategoryId(value, categories), [value, categories])

  const handleSelectChange = (selected: string) => {
    setError(null)
    if (selected === NEW_CATEGORY_VALUE) {
      if (!online) {
        setError('Création de catégorie indisponible hors ligne')
        return
      }
      setIsAdding(true)
      return
    }
    setIsAdding(false)
    onChange(selected || null)
  }

  const handleAdd = async () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      setError('Entrez un nom de catégorie')
      return
    }
    const exists = categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      setError('Cette catégorie existe déjà')
      return
    }
    if (!online) {
      setError('Création de catégorie indisponible hors ligne')
      return
    }
    setError(null)
    try {
      const createdId = await onCreateCategory(trimmed)
      if (!createdId) {
        setError('Impossible de récupérer la catégorie créée')
        return
      }
      setIsAdding(false)
      setNewName('')
      onChange(createdId)
    } catch {
      setError('Impossible de créer la catégorie')
    }
  }

  const handleCancelAdd = () => {
    setIsAdding(false)
    setNewName('')
    setError(null)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Catégorie</Label>
      {!isAdding ? (
        <Select
          id={id}
          value={selectedId ?? NO_CATEGORY_VALUE}
          onChange={(e) => handleSelectChange(e.target.value)}
          disabled={[disabled, isCreating].some(Boolean)}
        >
          <option value={NO_CATEGORY_VALUE}>Aucune catégorie</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE} disabled={!online}>
            + Nouvelle catégorie
          </option>
        </Select>
      ) : (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              if (error) setError(null)
            }}
            placeholder="Nom de la nouvelle catégorie"
            disabled={[disabled, isCreating].some(Boolean)}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={[disabled, isCreating, !online].some(Boolean)}
          >
            {isCreating ? '…' : 'Ajouter'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelAdd}
            disabled={isCreating}
          >
            Annuler
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
