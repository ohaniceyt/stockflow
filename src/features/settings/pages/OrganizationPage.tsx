import { useState, type SyntheticEvent } from 'react'
import {
  Star,
  Store,
  ShoppingCart,
  Plug,
  Percent,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useLocations, useSetDefaultLocation } from '@/features/locations/hooks/useLocations'
import { useOrganization, useUpdateOrganization } from '../hooks/useSettings'
import { SettingsTabs } from '../components/SettingsTabs'
import { PageHeader, PageSection } from '@/components/design-system'
import type { Organization } from '@/types'
import { COUNTRY_DEFAULTS, CURRENCIES, TIMEZONES, getCountryDefault } from '@/lib/countries'

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
    <div className="flex items-start gap-4 rounded-xl border p-4 transition-colors hover:bg-accent">
      <div className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={inputId} className="font-medium">{label}</Label>
          <label
            htmlFor={inputId}
            className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            data-state={checked ? 'checked' : 'unchecked'}
          >
            <span className="sr-only">{checked ? `Désactiver ${label}` : `Activer ${label}`}</span>
            <input
              id={inputId}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-primary peer-disabled:opacity-50" />
            <span className="absolute left-0.5 h-6 w-6 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function OrganizationForm({ organization, canManage, update }: OrganizationFormProps) {
  const [name, setName] = useState(organization.name)
  const [country, setCountry] = useState(organization.country ?? '')
  const [currency, setCurrency] = useState(organization.currency)
  const [timezone, setTimezone] = useState(organization.timezone)
  const [formError, setFormError] = useState<string | null>(null)

  const currencyChanged = currency !== organization.currency

  const applyCountryDefault = (code: string) => {
    setCountry(code)
    const defaults = getCountryDefault(code)
    if (defaults) {
      setCurrency(defaults.currency)
      setTimezone(defaults.timezone)
    }
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError("Le nom de l'organisation est requis.")
      return
    }
    update.mutate(
      {
        name: name.trim(),
        slug: organization.slug,
        country: country || null,
        currency,
        timezone,
      },
      {
        onError: (err) => setFormError(err.message),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <div className="space-y-2">
        <Label htmlFor="org-name">Nom de l'organisation</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Ma Boutique"
          disabled={update.isPending || !canManage}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-slug">
          Identifiant unique <span className="text-muted-foreground">(ex: ma-boutique)</span>
        </Label>
        <Input id="org-slug" value={organization.slug} placeholder="ma-boutique" disabled readOnly />
        <p className="text-sm text-muted-foreground">
          Lettres minuscules, chiffres et tirets uniquement. Utilisé pour le portail public.{' '}
          <span className="font-medium text-foreground">Géré par StockFlow :</span> contactez le
          support pour le modifier.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country">Pays de l’organisation</Label>
        <Select
          id="country"
          value={country}
          onChange={(e) => applyCountryDefault(e.target.value)}
          disabled={update.isPending || !canManage}
        >
          <option value="">Sélectionnez un pays…</option>
          {COUNTRY_DEFAULTS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
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
            {CURRENCIES.map((c) => (
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
            {TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {currencyChanged && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Vous changez la devise de l’organisation. Les futurs documents utiliseront{' '}
            <strong>{currency}</strong>. Les documents existants conservent leur devise d’origine.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-dashed p-4 text-sm">
        <p className="font-medium text-foreground">Portail public</p>
        <a
          href={`/store/${organization.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          {window.location.origin}/store/{organization.slug}
          <ExternalLink className="h-3 w-3" />
        </a>
        <p className="mt-1 text-sm text-muted-foreground">
          L'URL de votre boutique dépend de l'identifiant. Pour le changer, contactez le support.
        </p>
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
  const [hasStorefrontEnabled, setHasStorefrontEnabled] = useState(
    organization.hasStorefrontEnabled
  )
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
        country: organization.country,
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && <p className="text-sm text-destructive">{formError}</p>}

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
        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
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
          <p className="text-sm text-muted-foreground">
            URL publique :{' '}
            <code className="rounded bg-background px-1 py-0.5 text-xs">
              {window.location.origin}/store/{organization.slug}
            </code>
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

function BillingCard({ organization, canManage, update }: FeaturesCardProps) {
  const [hasTaxEnabled, setHasTaxEnabled] = useState(organization.hasTaxEnabled)
  const [taxName, setTaxName] = useState(organization.taxName ?? 'TVA')
  const [taxRate, setTaxRate] = useState(organization.taxRate ?? 0)
  const [taxId, setTaxId] = useState(organization.taxId ?? '')
  const [receiptPrefix, setReceiptPrefix] = useState(organization.receiptPrefix ?? 'RE')
  const [legalMentions, setLegalMentions] = useState(organization.legalMentions ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    if (hasTaxEnabled && (Number.isNaN(taxRate) || taxRate < 0)) {
      setFormError('Le taux de taxe doit être un nombre positif.')
      return
    }
    update.mutate(
      {
        name: organization.name,
        slug: organization.slug,
        country: organization.country,
        currency: organization.currency,
        timezone: organization.timezone,
        hasCashierEnabled: organization.hasCashierEnabled,
        hasStorefrontEnabled: organization.hasStorefrontEnabled,
        hasApiEnabled: organization.hasApiEnabled,
        storefrontLocationId: organization.storefrontLocationId,
        hasTaxEnabled,
        taxName: taxName.trim() || null,
        taxRate: hasTaxEnabled ? taxRate : null,
        taxId: taxId.trim() || null,
        receiptPrefix: receiptPrefix.trim() || null,
        legalMentions: legalMentions.trim() || null,
      },
      {
        onError: (err) => setFormError(err.message),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <FeatureToggle
        label="Taxe applicable"
        description="Applique une taxe (TVA ou autre) aux ventes et reçus de caisse."
        icon={Percent}
        checked={hasTaxEnabled}
        disabled={!canManage}
        onChange={setHasTaxEnabled}
      />

      {hasTaxEnabled && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tax-name">Nom de la taxe</Label>
            <Input
              id="tax-name"
              value={taxName}
              onChange={(e) => setTaxName(e.target.value)}
              placeholder="TVA"
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Taux (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-id">Identifiant fiscal</Label>
            <Input
              id="tax-id"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="ex: 12345678"
              disabled={!canManage}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="receipt-prefix">Préfixe reçus</Label>
        <Input
          id="receipt-prefix"
          value={receiptPrefix}
          onChange={(e) => setReceiptPrefix(e.target.value)}
          placeholder="RE"
          disabled={!canManage}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="legal-mentions">Mentions légales (affichées sur les reçus)</Label>
        <textarea
          id="legal-mentions"
          value={legalMentions}
          onChange={(e) => setLegalMentions(e.target.value)}
          placeholder="N° RCCM, centre fiscal, régime, etc."
          rows={3}
          disabled={!canManage}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {canManage && (
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
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
    <ul className="divide-y rounded-xl border">
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
            <Star className={`mr-1 h-3.5 w-3.5 ${location.isDefault ? 'fill-current' : ''}`} />
            {location.isDefault ? 'Par défaut' : 'Définir'}
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
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Paramètres"
        description="Gérez les informations, fonctionnalités et préférences de votre organisation."
      />

      <SettingsTabs />

      {error && <p className="text-destructive">{error.message}</p>}
      {update.isSuccess && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Organisation mise à jour.
        </p>
      )}

      <PageSection
        title="Organisation"
        description="Nom, identifiant, pays, devise et fuseau horaire."
      >
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
      </PageSection>

      <PageSection
        title="Fonctionnalités"
        description="Activez la caisse, le store front et l'API publique pour votre organisation."
      >
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
      </PageSection>

      <PageSection
        title="Reçus et taxes"
        description="Activez la taxe et configurez les mentions légales et la numérotation des reçus."
      >
        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : displayOrganization ? (
          <BillingCard
            key={`${formKey}-billing`}
            organization={displayOrganization}
            locations={locations}
            canManage={canManage}
            update={update}
          />
        ) : null}
      </PageSection>

      {displayOrganization?.hasStorefrontEnabled && (
        <PageSection
          title="Store front"
          description="Boutique publique et commandes en ligne."
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              URL publique :{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {window.location.origin}/store/{displayOrganization.slug}
              </code>
            </p>
            <Button variant="outline" asChild>
              <a
                href={`/store/${displayOrganization.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Ouvrir la boutique
              </a>
            </Button>
          </div>
        </PageSection>
      )}

      <PageSection
        title="Emplacements"
        description="Gérez vos dépôts, magasins et zones de stockage."
      >
        <div className="space-y-4">
          <LocationsList />
          <Button variant="outline" asChild>
            <a href="/locations">Gérer les emplacements</a>
          </Button>
        </div>
      </PageSection>
    </div>
  )
}
