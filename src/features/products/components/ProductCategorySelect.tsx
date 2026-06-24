import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { Category } from '@/types'

interface ProductCategorySelectProps {
  id?: string
  value: string
  onChange: (value: string | null) => void
  categories: Category[]
  onCreateCategory: (name: string) => Promise<void> | void
  isCreating?: boolean
}

const NEW_CATEGORY_VALUE = '__new__'
const NO_CATEGORY_VALUE = ''

export function ProductCategorySelect({
  id = 'category',
  value,
  onChange,
  categories,
  onCreateCategory,
  isCreating,
}: ProductCategorySelectProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSelectChange = (selected: string) => {
    setError(null)
    if (selected === NEW_CATEGORY_VALUE) {
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
    setError(null)
    try {
      await onCreateCategory(trimmed)
      setIsAdding(false)
      setNewName('')
      onChange(trimmed)
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
          value={value || NO_CATEGORY_VALUE}
          onChange={(e) => handleSelectChange(e.target.value)}
        >
          <option value={NO_CATEGORY_VALUE}>Aucune catégorie</option>
          {categories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>+ Nouvelle catégorie</option>
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
            disabled={isCreating}
          />
          <Button type="button" size="sm" onClick={handleAdd} disabled={isCreating}>
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
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
