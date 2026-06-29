import { useState } from 'react'
import { Copy, Key, Plus, Trash2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocations } from '@/features/locations/hooks/useLocations'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../hooks/useApiKeys'
import { SettingsTabs } from '@/features/settings/components/SettingsTabs'
import { PageHeader, PageSection, EmptyState } from '@/components/design-system'

const AVAILABLE_SCOPES = [
  { value: 'read:products', label: 'Lire les produits' },
  { value: 'read:stock', label: 'Lire les stocks' },
  { value: 'write:orders', label: 'Créer des commandes' },
  { value: 'read:orders', label: 'Lire les commandes' },
]

function formatDate(value: string | null): string {
  if (!value) return 'Jamais'
  return new Date(value).toLocaleString('fr-FR')
}

export default function ApiKeysPage() {
  const { session } = useAuth()
  const { data: apiKeys, isLoading } = useApiKeys()
  const { data: locations } = useLocations()
  const create = useCreateApiKey()
  const revoke = useRevokeApiKey()

  const [newKeyName, setNewKeyName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:products', 'read:stock'])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const canManage = session?.organization.hasApiEnabled ?? false

  const handleCreate = () => {
    if (!newKeyName.trim()) return
    create.mutate(
      {
        name: newKeyName.trim(),
        scopes: selectedScopes,
        allowedLocationIds: selectedLocations.length > 0 ? selectedLocations : null,
      },
      {
        onSuccess: (result) => {
          setCreatedKey(result.key)
          setNewKeyName('')
        },
      }
    )
  }

  const copyToClipboard = (value: string) => {
    void navigator.clipboard.writeText(value)
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Paramètres"
          description="Gérez les clés API de votre organisation."
        />
        <SettingsTabs />
        <EmptyState
          icon={ShieldCheck}
          title="API non activée"
          description="L'API publique n'est pas activée pour cette organisation."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Paramètres"
        description="Gérez les clés API de votre organisation."
      />

      <SettingsTabs />

      <PageSection
        title="Clés API"
        description="Connectez votre boutique externe à StockFlow."
      >
        {createdKey && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">
              Copiez cette clé maintenant, elle ne sera plus affichée :
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-background px-2 py-1 text-sm">
                {createdKey}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => copyToClipboard(createdKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setCreatedKey(null)}
            >
              Fermer
            </Button>
          </div>
        )}

        <div className="mb-6 space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-2">
            <Label htmlFor="key-name">Nom de la clé</Label>
            <Input
              id="key-name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Ex: Boutique Shopify"
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Permissions</span>
            <div className="space-y-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label key={scope.value} className="flex min-h-[44px] items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={(e) => {
                      setSelectedScopes((prev) =>
                        e.target.checked
                          ? [...prev, scope.value]
                          : prev.filter((s) => s !== scope.value)
                      )
                    }}
                  />
                  <span className="text-sm">{scope.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Emplacements autorisés</span>
            <p className="text-sm text-muted-foreground">
              Laissez vide pour autoriser tous les emplacements.
            </p>
            <div className="space-y-2">
              {locations?.map((location) => (
                <label key={location.id} className="flex min-h-[44px] items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedLocations.includes(location.id)}
                    onChange={(e) => {
                      setSelectedLocations((prev) =>
                        e.target.checked
                          ? [...prev, location.id]
                          : prev.filter((id) => id !== location.id)
                      )
                    }}
                  />
                  <span className="text-sm">{location.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleCreate}
            disabled={!newKeyName.trim() || selectedScopes.length === 0 || create.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            {create.isPending ? 'Création…' : 'Créer une clé'}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : !apiKeys ? (
          <p className="text-destructive">Erreur de chargement.</p>
        ) : apiKeys.length === 0 ? (
          <EmptyState
            icon={Key}
            title="Aucune clé active"
            description="Créez une clé API pour connecter une boutique externe."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {apiKeys.map((key) => (
              <li key={key.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-sm text-muted-foreground">Scopes: {key.scopes.join(', ')}</p>
                  <p className="text-sm text-muted-foreground">
                    Dernière utilisation: {formatDate(key.lastUsedAt)}
                  </p>
                  {key.allowedLocationIds && key.allowedLocationIds.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Emplacements: {key.allowedLocationIds.length}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-destructive"
                  disabled={revoke.isPending}
                  onClick={() => {
                    if (confirm('Révoquer cette clé ?')) {
                      revoke.mutate(key.id)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection
        title="Documentation rapide"
        description="Endpoints et header requis pour l'intégration."
      >
        <p className="text-sm text-muted-foreground">
          Endpoint de base :{' '}
          <code className="rounded bg-muted px-1 py-0.5">{window.location.origin}/api/v1</code>
        </p>
        <p className="text-sm text-muted-foreground">
          Header requis :{' '}
          <code className="rounded bg-muted px-1 py-0.5">X-StockFlow-API-Key: votre_cle</code>
        </p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
          <li>
            <code>GET /api/v1/products</code> — liste des produits actifs
          </li>
          <li>
            <code>GET /api/v1/stock?location_id=...</code> — niveaux de stock
          </li>
          <li>
            <code>POST /api/v1/orders</code> — créer une commande
          </li>
        </ul>
      </PageSection>
    </div>
  )
}
