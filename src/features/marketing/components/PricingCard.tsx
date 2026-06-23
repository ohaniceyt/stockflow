import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PricingCardProps {
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
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
  features,
  cta,
  href,
  highlighted,
  popular,
}: PricingCardProps) {
  const isFree = monthlyPrice === 0 && yearlyPrice === 0
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
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Le plus populaire
        </span>
      )}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{isFree ? '0 €' : `${monthly} €`}</span>
          {!isFree && <span className="text-sm text-muted-foreground">/mois</span>}
        </div>
        {!isFree && (
          <p className="text-xs text-muted-foreground">
            {yearly} €/an (économisez 2 mois)
          </p>
        )}
      </div>

      <ul className="mb-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button variant={highlighted ? 'default' : 'outline'} className="w-full" onClick={() => window.location.href = href}>
        {cta}
      </Button>
    </div>
  )
}
