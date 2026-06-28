import { ArrowRight } from 'lucide-react'
import { MarketingButton } from './MarketingButton'

export function FinalCta() {
  return (
    <section className="bg-muted px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          Prêt à transformer votre gestion de stock ?
        </h2>
        <p className="mt-6 text-lg text-foreground/90">
          Testez StockFlow 1 mois gratuitement et découvrez ce qu’il peut faire pour votre
          entreprise.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <MarketingButton to="/signup" size="lg" className="gap-2">
            Essayer 1 mois gratuit <ArrowRight className="h-4 w-4" />
          </MarketingButton>
          <MarketingButton to="/pricing" variant="outline" size="lg">
            Voir les tarifs
          </MarketingButton>
        </div>
      </div>
    </section>
  )
}
