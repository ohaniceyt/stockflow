import { useState, type SyntheticEvent } from 'react'
import { Building2, MapPin, Star, Store, ShoppingCart, Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useLocations, useSetDefaultLocation } from '@/features/locations/hooks/useLocations'
import { useOrganization, useUpdateOrganization } from '../hooks/useSettings'
import { SettingsTabs } from '../components/SettingsTabs'
import type { Organization } from '@/types'

const currencies = [
  { value: 'XOF', label: 'Franc CFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar US (USD)' },
  { value: 'GBP', label: 'Livre sterling (GBP)' },
]

const timezones = [
  { value: 'Africa/Abidjan', label: 'Africa/Abidjan (UTC+0)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (UTC+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1/+2)' },
  { value: 'America/New_York', label: 'America/New_York (UTC-5/-4)' },
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

function isValidSlug(value: string): boolean {
  return /^[a-z0-9-]+$/.test(value) && value.length >= 2 && value.length <= 50
}

interface OrganizationFormProps {
  organization: Organization
  canManage: boolean
  update: ReturnType<typeof useUpdateOrganization>
}

interface FeatureToggleProps {
  label: string
  description: string
  icon: React.ElementType
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

function FeatureToggle({
  label,
  description,
  icon: Icon,
  checked,
  disabled,
  onChange,
}: FeatureToggleProps) {
  const inputId = `feature-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <Label htmlFor={inputId} className="font-medium cursor-pointer">{label}</Label>
          <input
            id={inputId}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function OrganizationForm({ organization, canManage, update }: OrganizationFormProps) {
  const [name, setName] = useState(organization.name)
  const [slug, setSlug] = useState(organization.slug)
  const [currency, setCurrency] = useState(organization.currency)
  const [timezone, setTimezone] = useState(organization.timezone)
  const [formError, setFormError] = useState<string | null>(null)

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value))
    }
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError("Le nom de l'organisation est requis.")
      return
    }
    if (!isValidSlug(slug.trim())) {
      setFormError(
        "L'identifiant doit contenir entre 2 et 50 caractères, uniquement des minuscules, chiffres et tirets."
      )
      return
    }
    update.mutate(
      {
        name: name.trim(),
        slug: slug.trim(),
        currency,
        timezone,
      },
      {
        onError: (err) => setFormError(err.message),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && <p className="text-destructive">{formError}</p>}

      <div className="space-y-2">
        <Label htmlFor="org-name">Nom de l'organisation</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Ex: Ma Boutique"
          disabled={update.isPending || !canManage}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-slug">
          Identifiant unique <span className="text-muted-foreground">(ex: ma-boutique)</span>
        </Label>
        <Input
          id="org-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="ma-boutique"
          disabled={update.isPending || !canManage}
        />
        <p className="text-xs text-muted-foreground">
          Lettres minuscules, chiffres et tirets uniquement. Utilisé pour le portail public.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="currency">Devise</Label>
          <Select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={update.isPending || !canManage}
          >
            {currencies.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Fuseau horaire</Label>
          <Select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={update.isPending || !canManage}
          >
            {timezones.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {canManage && (
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      )}
    </form>
  )
}

interface FeaturesCardProps {
  organization: Organization
  locations: { id: string; name: string }[] | undefined
  canManage: boolean
  update: ReturnType<typeof useUpdateOrganization>
}

function FeaturesCard({ organization, locations, canManage, update }: FeaturesCardProps) {
  const [hasCashierEnabled, setHasCashierEnabled] = useState(organization.hasCashierEnabled)
  const [hasStorefrontEnabled, setHasStorefrontEnabled] = useState(organization.hasStorefrontEnabled)
  const [hasApiEnabled, setHasApiEnabled] = useState(organization.hasApiEnabled)
  const [storefrontLocationId, setStorefrontLocationId] = useState(
    organization.storefrontLocationId ?? ''
  )
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    if (hasStorefrontEnabled && !storefrontLocationId) {
      setFormError('Sélectionnez un emplacement pour le store front.')
      return
    }
    update.mutate(
      {
        name: organization.name,
        slug: organization.slug,
        currency: organization.currency,
        timezone: organization.timezone,
        hasCashierEnabled,
        hasStorefrontEnabled,
        hasApiEnabled,
        storefrontLocationId: hasStorefrontEnabled ? storefrontLocationId : null,
      },
      {
        onError: (err) => setFormError(err.message),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && <p className="text-destructive">{formError}</p>}

      <div className="space-y-3">
        <FeatureToggle
          label="Caisse"
          description="Permet d'ouvrir des sessions de caisse et d'enregistrer des ventes par emplacement."
          icon={ShoppingCart}
          checked={hasCashierEnabled}
          disabled={!canManage}
          onChange={setHasCashierEnabled}
        />
        <FeatureToggle
          label="Store front"
          description="Active une boutique publique accessible via l'identifiant de l'organisation."
          icon={Store}
          checked={hasStorefrontEnabled}
          disabled={!canManage}
          onChange={setHasStorefrontEnabled}
        />
        <FeatureToggle
          label="API publique"
          description="Autorise la création de clés API pour connecter une boutique externe."
          icon={Plug}
          checked={hasApiEnabled}
          disabled={!canManage}
          onChange={setHasApiEnabled}
        />
      </div>

      {hasStorefrontEnabled && (
        <div className="space-y-2">
          <Label htmlFor="storefront-location">Emplacement du store front</Label>
          <Select
            id="storefront-location"
            value={storefrontLocationId}
            onChange={(e) => setStorefrontLocationId(e.target.value)}
            disabled={!canManage}
          >
            <option value="">Sélectionner un emplacement</option>
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            URL publique : <code>{window.location.origin}/store/{organization.slug}</code>
          </p>
        </div>
      )}

      {canManage && (
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Enregistrer les fonctionnalités'}
        </Button>
      )}
    </form>
  )
}

function LocationsList() {
  const { data: locations, isLoading, error } = useLocations()
  const setDefault = useSetDefaultLocation()

  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>
  if (error) return <p className="text-destructive">{error.message}</p>
  if (!locations || locations.length === 0)
    return <p className="text-muted-foreground">Aucun emplacement enregistré.</p>

  return (
    <ul className="divide-y rounded-lg border">
      {locations.map((location) => (
        <li key={location.id} className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium">{location.name}</p>
            {location.description && (
              <p className="truncate text-sm text-muted-foreground">{location.description}</p>
            )}
          </div>
          <Button
            type="button"
            variant={location.isDefault ? 'default' : 'outline'}
            size="sm"
            disabled={location.isDefault || setDefault.isPending}
            onClick={() => setDefault.mutate(location.id)}
            aria-label={location.isDefault ? 'Emplacement par défaut' : 'Définir par défaut'}
          >
            <Star className="mr-1 h-3.5 w-3.5" />
            {location.isDefault ? 'Par défaut' : 'Par défaut'}
          </Button>
        </li>
      ))}
    </ul>
  )
}

export default function OrganizationPage() {
  const { session, hasRole } = useAuth()
  const { data: organization, isLoading, error } = useOrganization()
  const { data: locations } = useLocations()
  const update = useUpdateOrganization()

  const canManage = hasRole(['super_admin', 'admin'])

  const displayOrganization = organization ?? session?.organization
  const formKey = displayOrganization?.id ?? 'new'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">Gérez les informations de votre organisation.</p>
      </div>

      <SettingsTabs />

      {error && <p className="text-destructive">{error.message}</p>}
      {update.isSuccess && <p className="text-sm text-green-600">Organisation mise à jour.</p>}

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Organisation</h2>
            <p className="text-sm text-muted-foreground">
              Nom, identifiant, devise et fuseau horaire.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : displayOrganization ? (
          <OrganizationForm
            key={formKey}
            organization={displayOrganization}
            canManage={canManage}
            update={update}
          />
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Fonctionnalités</h2>
            <p className="text-sm text-muted-foreground">
              Activez la caisse, le store front et l'API publique pour votre organisation.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : displayOrganization ? (
          <FeaturesCard
            key={`${formKey}-features`}
            organization={displayOrganization}
            locations={locations}
            canManage={canManage}
            update={update}
          />
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Emplacements</h2>
            <p className="text-sm text-muted-foreground">
              Gérez vos dépôts, magasins et zones de stockage.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <LocationsList />
          <Button variant="outline" asChild>
            <a href="/locations">Gérer les emplacements</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
