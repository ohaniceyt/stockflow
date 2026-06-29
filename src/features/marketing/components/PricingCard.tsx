import { Check } from 'lucide-react'
import { MarketingButton } from './MarketingButton'
import { cn } from '@/lib/utils'

interface PricingCardProps {
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  priceMode?: 'free' | 'fixed' | 'custom'
  features: string[]
  cta: string
  href: string
  highlighted?: boolean
  popular?: boolean
}

export function PricingCard({
  name,
  description,
  monthlyPrice,
  yearlyPrice,
  priceMode = monthlyPrice === 0 && yearlyPrice === 0 ? 'free' : 'fixed',
  features,
  cta,
  href,
  highlighted,
  popular,
}: PricingCardProps) {
  const monthly = (monthlyPrice / 100).toLocaleString('fr-FR')
  const yearly = (yearlyPrice / 100).toLocaleString('fr-FR')

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md',
        highlighted && 'border-primary ring-1 ring-primary'
      )}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-base font-semibold text-primary-foreground">
          Le plus populaire
        </span>
      )}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-base text-muted-foreground">{description}</p>
      </div>

      <div className="mb-6">
        {priceMode === 'custom' ? (
          <span className="text-3xl font-bold">Sur mesure</span>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">
              {priceMode === 'free' ? '0 €' : `${monthly} €`}
            </span>
            {priceMode !== 'free' && <span className="text-base text-muted-foreground">/mois</span>}
          </div>
        )}
        {priceMode === 'fixed' && (
          <p className="text-base text-muted-foreground">{yearly} €/an (économisez 2 mois)</p>
        )}
      </div>

      <ul className="mb-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-base">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <MarketingButton
        to={href}
        variant={highlighted ? 'default' : 'outline'}
        className="w-full"
      >
        {cta}
      </MarketingButton>
    </div>
  )
}
