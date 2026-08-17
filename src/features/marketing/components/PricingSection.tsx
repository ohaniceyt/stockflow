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
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')

  const currencyLabels: Record<string, string> = {
    EUR: 'EUR (€)',
    USD: 'USD ($)',
    XOF: 'XOF (F CFA)',
  }

  const isYearly = billing === 'yearly'

  return (
    <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Des tarifs clairs, sans surprise
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Commencez gratuitement. Passez à un plan supérieur quand votre activité grandit. Changez
            d’échelle à tout moment.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <div
              className="inline-flex items-center rounded-full border bg-muted/50 p-1"
              role="radiogroup"
              aria-label="Période de facturation"
            >
              <label className="relative cursor-pointer">
                <input
                  type="radio"
                  name="billing"
                  value="monthly"
                  checked={billing === 'monthly'}
                  onChange={() => setBilling('monthly')}
                  className="peer sr-only"
                />
                <span className="block rounded-full px-4 py-2 text-base font-medium text-muted-foreground transition peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow peer-hover:text-foreground">
                  Mensuel
                </span>
              </label>
              <label className="relative cursor-pointer">
                <input
                  type="radio"
                  name="billing"
                  value="yearly"
                  checked={billing === 'yearly'}
                  onChange={() => setBilling('yearly')}
                  className="peer sr-only"
                />
                <span className="block rounded-full px-4 py-2 text-base font-medium text-muted-foreground transition peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow peer-hover:text-foreground">
                  Annuel <span className="ml-1 text-sm font-semibold text-primary">-20%</span>
                </span>
              </label>
            </div>

            <div
              className="inline-flex items-center rounded-full border bg-muted/50 p-1"
              role="radiogroup"
              aria-label="Devise"
            >
              {currencies.map((c) => (
                <label key={c} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="currency"
                    value={c}
                    checked={currency === c}
                    onChange={() => onCurrencyChange(c)}
                    className="peer sr-only"
                    aria-label={`Devise ${currencyLabels[c] ?? c}`}
                  />
                  <span className="block rounded-full px-4 py-2 text-base font-medium text-muted-foreground transition peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow peer-hover:text-foreground">
                    {currencyLabels[c] ?? c}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div
          id="pricing-cards"
          className="grid gap-8 lg:grid-cols-3"
          role="tabpanel"
          aria-label="Grille des tarifs"
        >
          {tiers.map((tier) => {
            const price =
              isYearly && tier.yearlyPrice ? format(tier.yearlyPrice / 12, 2) : tier.price
            const period =
              isYearly && tier.yearlyPrice ? '/mois, facturé annuellement' : tier.period
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
                {isYearly && tier.yearlyPrice && (
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
          1 mois d’essai gratuit sur tous les plans payants. Sans carte bancaire. Annulation à tout
          moment.
        </p>
      </div>
    </section>
  )
}
