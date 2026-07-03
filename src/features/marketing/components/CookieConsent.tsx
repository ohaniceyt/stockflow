import { Button } from '@/components/ui/button'
import { useCookieConsent, saveConsent } from '../hooks/useCookieConsent'

export function CookieConsentBanner() {
  const consent = useCookieConsent()

  const accept = (state: Parameters<typeof saveConsent>[0]) => {
    saveConsent(state)
  }

  if (consent !== 'pending') return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consentement aux cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card p-4 shadow-lg sm:p-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1 text-sm">
          <p className="font-medium">Votre confidentialité compte</p>
          <p className="text-muted-foreground">
            StockFlow utilise des cookies nécessaires au fonctionnement du service. Vous pouvez
            accepter les cookies d’analyse pour nous aider à améliorer l’expérience.{' '}
            <a href="/cookies" className="underline hover:text-foreground">
              En savoir plus
            </a>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => accept('necessary')}>
            Refuser
          </Button>
          <Button size="sm" onClick={() => accept('all')}>
            Tout accepter
          </Button>
        </div>
      </div>
    </div>
  )
}
