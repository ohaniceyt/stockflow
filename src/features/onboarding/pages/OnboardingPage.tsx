import { useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, MapPin, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/features/auth/context/AuthContext'

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

export default function OnboardingPage() {
  const { session, completeOnboarding, hasRole } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [orgName, setOrgName] = useState('')
  const [currency, setCurrency] = useState('XOF')
  const [timezone, setTimezone] = useState('Africa/Abidjan')
  const [defaultLocationName, setDefaultLocationName] = useState('Dépôt principal')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!session) {
    return null
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

  const validateStep = () => {
    setError(null)
    if (step === 1) {
      if (!orgName.trim()) {
        setError('Le nom de l’organisation est requis')
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
  }

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateStep()) return
    setIsSubmitting(true)
    try {
      await completeOnboarding({
        orgName: orgName.trim(),
        currency,
        timezone,
        defaultLocationName: defaultLocationName.trim(),
      })
      void navigate('/', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
    } finally {
      setIsSubmitting(false)
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
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Ex: Ma Boutique"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Devise</Label>
                <Select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
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
                >
                  {timezones.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
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
