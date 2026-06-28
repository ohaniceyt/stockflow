import { useState, useMemo, type SyntheticEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, MapPin, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/features/auth/context/AuthContext'
import { COUNTRY_DEFAULTS, CURRENCIES, TIMEZONES, getCountryDefault } from '@/lib/countries'

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

export default function OnboardingPage() {
  const { session, completeOnboarding, hasRole, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planParam = searchParams.get('plan') ?? 'free'
  const selectedPlan = ['free', 'starter', 'pro'].includes(planParam) ? planParam : 'free'

  const [step, setStep] = useState(1)
  const [orgName, setOrgName] = useState(session?.organization.name ?? '')
  const [orgSlug, setOrgSlug] = useState(session?.organization.slug ?? '')
  const [country, setCountry] = useState('CI')
  const [currency, setCurrency] = useState('XOF')
  const [timezone, setTimezone] = useState('Africa/Abidjan')
  const [defaultLocationName, setDefaultLocationName] = useState('Dépôt principal')

  const countryDefault = useMemo(() => getCountryDefault(country), [country])

  const applyCountryDefault = (code: string) => {
    const defaults = getCountryDefault(code)
    if (defaults) {
      setCountry(code)
      setCurrency(defaults.currency)
      setTimezone(defaults.timezone)
    }
  }
  const [error, setError] = useState<string | null>(null)
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!session) {
    return null
  }

  if (!session.user.emailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Vérification requise</h1>
          <p className="text-muted-foreground">
            Veuillez vérifier votre adresse email avant de créer une organisation. Un lien de
            vérification vous a été envoyé.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <a href="/login">Retour à la connexion</a>
            </Button>
            <Button variant="outline" className="w-full" onClick={() => void signOut()}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!hasRole(['super_admin', 'admin'])) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Onboarding requis</h1>
          <p className="mt-2 text-muted-foreground">
            Veuillez contacter un administrateur pour finaliser la configuration de l’organisation.
          </p>
        </div>
      </div>
    )
  }

  const handleOrgNameChange = (value: string) => {
    setOrgName(value)
    if (!orgSlug || orgSlug === slugify(orgName)) {
      setOrgSlug(slugify(value))
    }
    setError(null)
    setSuggestedSlug(null)
  }

  const validateStep = () => {
    setError(null)
    setSuggestedSlug(null)
    if (step === 1) {
      if (!orgName.trim()) {
        setError('Le nom de l’organisation est requis')
        return false
      }
      if (!orgSlug.trim()) {
        setError('L’identifiant (slug) de l’organisation est requis')
        return false
      }
      if (!isValidSlug(orgSlug)) {
        setError(
          'L’identifiant doit contenir entre 2 et 50 caractères, uniquement des minuscules, chiffres et tirets.'
        )
        return false
      }
      if (!country) {
        setError('Le pays de l’organisation est requis')
        return false
      }
    }
    if (step === 2) {
      if (!defaultLocationName.trim()) {
        setError('Le nom de l’emplacement par défaut est requis')
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (!validateStep()) return
    setStep((s) => s + 1)
  }

  const handleFormSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleNext()
  }

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1))
    setError(null)
    setSuggestedSlug(null)
  }

  const extractSuggestedSlug = (message: string): string | null => {
    const match = /suggestion["']?\s*[:=]\s*["']?([a-z0-9-]+)/i.exec(message)
    return match?.[1] ?? null
  }

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateStep()) return
    setIsSubmitting(true)
    try {
      await completeOnboarding({
        orgName: orgName.trim(),
        orgSlug: orgSlug.trim(),
        country,
        currency,
        timezone,
        defaultLocationName: defaultLocationName.trim(),
        plan: selectedPlan as 'free' | 'starter' | 'pro',
      })
      void navigate('/dashboard', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
      const suggestion = extractSuggestedSlug(message)
      if (suggestion) {
        setSuggestedSlug(suggestion)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const applySuggestedSlug = () => {
    if (suggestedSlug) {
      setOrgSlug(suggestedSlug)
      setSuggestedSlug(null)
      setError(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Bienvenue sur StockFlow</h1>
          <p className="text-muted-foreground">Finalisez la configuration de votre organisation.</p>
        </div>

        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-8 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        <form
          onSubmit={step === 3 ? handleSubmit : handleFormSubmit}
          className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
        >
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Nom de l’organisation</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  placeholder="Ex: Ma Boutique"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">
                  Identifiant unique du portail{' '}
                  <span className="text-muted-foreground">(ex: ma-boutique)</span>
                </Label>
                <Input
                  id="org-slug"
                  value={orgSlug}
                  onChange={(e) => {
                    setOrgSlug(e.target.value)
                    setError(null)
                    setSuggestedSlug(null)
                  }}
                  placeholder="ma-boutique"
                />
                <p className="text-xs text-muted-foreground">
                  Lettres minuscules, chiffres et tirets uniquement. Cet identifiant sera utilisé
                  pour le portail public de votre organisation.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Pays de l’organisation</Label>
                <Select
                  id="country"
                  value={country}
                  onChange={(e) => applyCountryDefault(e.target.value)}
                >
                  {COUNTRY_DEFAULTS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  La devise et le fuseau horaire par défaut sont automatiquement sélectionnés selon
                  le pays. Vous pouvez les ajuster ci-dessous si nécessaire.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currency">Devise</Label>
                  <Select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
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
                  >
                    {TIMEZONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <MapPin className="h-5 w-5" />
                <h2 className="font-semibold">Emplacement par défaut</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                StockFlow a besoin d’au moins un emplacement (dépôt, magasin, etc.) pour suivre le
                stock.
              </p>
              <div className="space-y-2">
                <Label htmlFor="location-name">Nom de l’emplacement</Label>
                <Input
                  id="location-name"
                  value={defaultLocationName}
                  onChange={(e) => setDefaultLocationName(e.target.value)}
                  placeholder="Ex: Magasin principal"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
              <h2 className="font-semibold">Récapitulatif</h2>
              <div className="rounded-lg bg-muted p-4 text-left text-sm">
                <p>
                  <span className="text-muted-foreground">Organisation :</span>{' '}
                  <span className="font-medium">{orgName}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Identifiant :</span>{' '}
                  <span className="font-medium">{orgSlug}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Pays :</span>{' '}
                  <span className="font-medium">{countryDefault?.name ?? country}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Devise :</span>{' '}
                  <span className="font-medium">{currency}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Fuseau horaire :</span>{' '}
                  <span className="font-medium">{timezone}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Emplacement :</span>{' '}
                  <span className="font-medium">{defaultLocationName}</span>
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {suggestedSlug && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
              <p className="font-medium">Identifiant suggéré : {suggestedSlug}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={applySuggestedSlug}
              >
                Utiliser cet identifiant
              </Button>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            Vous avez reçu une invitation pour rejoindre une organisation ?{' '}
            <Link to="/invite" className="text-primary hover:underline">
              Rejoindre avec un lien d’invitation
            </Link>
          </div>

          <div className="flex justify-between pt-2">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
                Retour
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button type="button" onClick={handleNext}>
                Suivant
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Finalisation…' : 'Terminer'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
