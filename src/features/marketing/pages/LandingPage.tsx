import { SkipLink } from '../components/SkipLink'
import { MarketingHeader } from '../components/MarketingHeader'
import { HeroSection } from '../components/HeroSection'
import { PricingSection } from '../components/PricingSection'
import { FinalCta } from '../components/FinalCta'
import { MarketingFooter } from '../components/MarketingFooter'
import { usePricingCurrency } from '../hooks/usePricingCurrency'

const pricingPlans = [
  {
    name: 'Starter',
    description: 'Petites équipes et boutiques',
    monthlyPrice: 4900,
    yearlyPrice: 49900,
    features: [
      '2 utilisateurs',
      '100 produits',
      '2 emplacements',
      '2 000 mouvements/mois',
      'Facturation incluse',
      'Support prioritaire',
    ],
    cta: '1 mois gratuit',
    href: '/signup?plan=starter',
  },
  {
    name: 'Pro',
    description: 'Entreprises en croissance',
    monthlyPrice: 9900,
    yearlyPrice: 99900,
    features: [
      '20 utilisateurs',
      '5 000 produits',
      '10 emplacements',
      '20 000 mouvements/mois',
      'API & webhooks',
      'Storefront',
      'Support dédié',
    ],
    cta: '1 mois gratuit',
    href: '/signup?plan=pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    description: 'Grandes structures et intégrations avancées',
    monthlyPrice: 0,
    yearlyPrice: 0,
    priceMode: 'custom' as const,
    features: [
      'Utilisateurs illimités',
      'Produits illimités',
      'Emplacements illimités',
      'Mouvements illimités',
      'API + SLA',
      'Support sur mesure',
      'Déploiement dédié possible',
    ],
    cta: "Contacter l'équipe",
    href: 'mailto:team@stockflow.grandigix.com',
  },
]

export default function LandingPage() {
  const { currency, currencies, setCurrency, format } = usePricingCurrency()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <MarketingHeader />

      <main id="main-content">
        <HeroSection />

        <PricingSection
          currency={currency}
          currencies={currencies}
          onCurrencyChange={setCurrency}
          format={format}
          tiers={pricingPlans.map((p) => ({
            name: p.name,
            price: p.priceMode === 'custom' ? 'Sur mesure' : format(p.monthlyPrice, 0),
            period: p.priceMode === 'custom' ? '' : '/mois',
            description: p.description,
            features: p.features,
            cta: p.cta,
            ctaLink: p.href,
            highlighted: p.highlighted,
            yearlyPrice: p.yearlyPrice,
          }))}
        />

        <FinalCta />
      </main>

      <MarketingFooter />
    </div>
  )
}
