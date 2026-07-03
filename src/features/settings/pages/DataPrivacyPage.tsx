import { useState } from 'react'
import { AlertCircle, Archive, CheckCircle2, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/context/AuthContext'
import { SettingsTabs } from '../components/SettingsTabs'
import { PageHeader, PageSection, StatusBadge } from '@/components/design-system'
import { edgeFetch } from '@/services/edgeFunctions'

const requestTypes = [
  { value: 'access', label: 'Accès', description: 'Recevoir une copie de mes données.' },
  {
    value: 'portability',
    label: 'Portabilité',
    description: 'Exporter mes données dans un format réutilisable.',
  },
  {
    value: 'rectification',
    label: 'Rectification',
    description: 'Signaler une donnée incorrecte.',
  },
  {
    value: 'deletion',
    label: 'Effacement',
    description: 'Demander la suppression de mes données.',
  },
] as const

type RequestType = (typeof requestTypes)[number]['value']

export default function DataPrivacyPage() {
  const { session } = useAuth()
  const [type, setType] = useState<RequestType>('access')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setSubmitted(false)
    if (!session) {
      setError('Vous devez être connecté pour faire une demande.')
      return
    }
    setIsLoading(true)
    try {
      await edgeFetch('data-subject-request', {
        method: 'POST',
        body: JSON.stringify({ request_type: type, details: details.trim() || null }),
      })
      setSubmitted(true)
      setDetails('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la demande')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Paramètres" description="Vos données et vos droits RGPD." />

      <SettingsTabs />

      {error && (
        <StatusBadge variant="danger" className="w-full justify-start">
          <AlertCircle className="mr-2 h-4 w-4" />
          {error}
        </StatusBadge>
      )}
      {submitted && (
        <StatusBadge variant="success" className="w-full justify-start">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Demande enregistrée. Notre équipe vous contactera par email.
        </StatusBadge>
      )}

      <PageSection
        title="Droit d'accès et d'export"
        description="Demandez une copie de vos données personnelles et de votre activité."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" asChild>
            <a href="mailto:team@stockflow.grandigix.com?subject=Demande%20d%27acc%C3%A8s%20RGPD">
              <Download className="mr-2 h-4 w-4" />
              Demander un export
            </a>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Vous recevrez une réponse sous 30 jours. Certaines données comptables peuvent être
          conservées pendant la période légale requise.
        </p>
      </PageSection>

      <PageSection
        title="Droit à l'effacement"
        description="Demandez la suppression de votre compte et de vos données."
      >
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm">
            La suppression d'un compte StockFlow est irréversible. Les données comptables et
            fiscales peuvent être conservées sous forme anonymisée selon les obligations légales.
          </p>
          <Button type="button" variant="destructive" className="mt-4" asChild>
            <a href="mailto:team@stockflow.grandigix.com?subject=Demande%20d%27effacement%20RGPD">
              <Trash2 className="mr-2 h-4 w-4" />
              Demander la suppression
            </a>
          </Button>
        </div>
      </PageSection>

      <PageSection
        title="Formulaire de demande RGPD"
        description="Choisissez le type de demande et précisez votre besoin."
      >
        <div className="space-y-3">
          <Label htmlFor="request-type">Type de demande</Label>
          <select
            id="request-type"
            value={type}
            onChange={(e) => setType(e.target.value as RequestType)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {requestTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.description}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="details">Précisions (optionnel)</Label>
          <Textarea
            id="details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Décrivez les données concernées ou toute précision utile..."
            rows={4}
          />
        </div>

        <Button
          type="button"
          className="mt-4"
          onClick={() => void handleSubmit()}
          disabled={isLoading}
        >
          <Archive className="mr-2 h-4 w-4" />
          {isLoading ? 'Envoi…' : 'Envoyer la demande'}
        </Button>
      </PageSection>

      <PageSection title="Délégué à la protection des données (DPO)" description="Contact RGPD.">
        <p className="text-sm">
          Pour exercer vos droits ou poser une question sur la protection des données, contactez le
          DPO à{' '}
          <a href="mailto:team@stockflow.grandigix.com" className="font-medium underline">
            team@stockflow.grandigix.com
          </a>
          .
        </p>
      </PageSection>
    </div>
  )
}
