import { useState } from 'react'
import { Check } from 'lucide-react'
import { MarketingButton } from './MarketingButton'

interface PricingTier {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  ctaLink: string
  highlighted?: boolean
  yearlyPrice?: number
}

interface PricingSectionProps {
  tiers: PricingTier[]
  currency: string
  currencies: string[]
  onCurrencyChange: (currency: string) => void
  format: (cents: number, fractionDigits?: number) => string
}

export function PricingSection({
  tiers,
  currency,
  currencies,
  onCurrencyChange,
  format,
}: PricingSectionProps) {
  const [yearly, setYearly] = useState(false)

  const currencyLabels: Record<string, string> = {
    EUR: 'EUR (€)',
    USD: 'USD ($)',
    XOF: 'XOF (F CFA)',
  }

  return (
    <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Des tarifs simples et transparents
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choisissez le plan qui correspond à votre activité. Changez d’échelle à tout moment.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-3 rounded-full border bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => setYearly(false)}
                className={`rounded-full px-4 py-1.5 text-base font-medium transition ${
                  !yearly ? 'bg-background text-foreground shadow' : 'text-muted-foreground'
                }`}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => setYearly(true)}
                className={`rounded-full px-4 py-1.5 text-base font-medium transition ${
                  yearly ? 'bg-background text-foreground shadow' : 'text-muted-foreground'
                }`}
              >
                Annuel <span className="ml-1 text-base text-primary">-20%</span>
              </button>
            </div>

            <div className="inline-flex items-center rounded-full border bg-muted/50 p-1">
              {currencies.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCurrencyChange(c)}
                  className={`rounded-full px-4 py-1.5 text-base font-medium transition ${
                    currency === c
                      ? 'bg-background text-foreground shadow'
                      : 'text-muted-foreground'
                  }`}
                >
                  {currencyLabels[c] ?? c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          {tiers.map((tier) => {
            const price = yearly && tier.yearlyPrice ? format(tier.yearlyPrice / 12, 2) : tier.price
            const period = yearly && tier.yearlyPrice ? '/mois, facturé annuellement' : tier.period
            return (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border p-8 shadow-sm ${
                  tier.highlighted
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'bg-background'
                }`}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-base font-semibold text-primary-foreground">
                    Le plus populaire
                  </span>
                )}
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <p
                  className={`mt-2 text-base ${tier.highlighted ? 'text-foreground/80' : 'text-muted-foreground'}`}
                >
                  {tier.description}
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">{price}</span>
                  <span
                    className={`text-base ${tier.highlighted ? 'text-foreground/80' : 'text-muted-foreground'}`}
                  >
                    {period}
                  </span>
                </div>
                {yearly && tier.yearlyPrice && (
                  <p className="mt-1 text-base text-primary">
                    {format(tier.yearlyPrice, 0)} facturés par an
                  </p>
                )}
                <ul className="mt-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-base">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <MarketingButton
                  to={tier.ctaLink}
                  className="mt-8 w-full"
                  variant={tier.highlighted ? 'default' : 'outline'}
                >
                  {tier.cta}
                </MarketingButton>
              </div>
            )
          })}
        </div>
        <p className="mt-8 text-center text-base text-muted-foreground">
          Tous les plans payants incluent 1 mois d’essai gratuit. Annulation à tout moment.
        </p>
      </div>
    </section>
  )
}
