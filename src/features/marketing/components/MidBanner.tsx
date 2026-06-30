import { ArrowRight } from 'lucide-react'
import { MarketingButton } from './MarketingButton'

export function MidBanner() {
  return (
    <section className="bg-primary px-4 py-16 text-primary-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Passez à la vitesse supérieure dès aujourd’hui
            </h2>
            <p className="mt-4 text-lg text-primary-foreground">
              Rejoignez des centaines de PME qui gèrent leur stock et leurs ventes avec StockFlow.
            </p>
          </div>
          <MarketingButton to="/signup" size="lg" variant="secondary" className="gap-2">
            Créer mon compte <ArrowRight className="h-4 w-4" />
          </MarketingButton>
        </div>
      </div>
    </section>
  )
}
