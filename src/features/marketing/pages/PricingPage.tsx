import { Check, ArrowRight, HelpCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { MarketingHeader } from '../components/MarketingHeader'
import { MarketingFooter } from '../components/MarketingFooter'

const plans = [
  {
    name: 'Gratuit',
    price: '0 €',
    period: '/mois',
    description: 'Idéal pour tester et démarrer.',
    features: [
      '1 utilisateur',
      '10 produits',
      '1 emplacement',
      '100 mouvements/mois',
      'Gestion de stock de base',
      'Support par email',
    ],
    cta: 'Commencer gratuitement',
    ctaLink: '/signup?plan=free',
  },
  {
    name: 'Starter',
    price: '49 €',
    period: '/mois',
    description: 'Petites équipes et boutiques.',
    features: [
      '2 utilisateurs',
      '100 produits',
      '2 emplacements',
      '2 000 mouvements/mois',
      'Caisse & facturation',
      'Mode offline',
      'Support prioritaire',
    ],
    cta: 'Essai 14 jours',
    ctaLink: '/signup?plan=starter',
    highlighted: true,
  },
  {
    name: 'Pro',
    price: '99 €',
    period: '/mois',
    description: 'Entreprises en croissance.',
    features: [
      '20 utilisateurs',
      '5 000 produits',
      '10 emplacements',
      '20 000 mouvements/mois',
      'API & webhooks',
      'Storefront',
      'Support dédié',
    ],
    cta: 'Essai 14 jours',
    ctaLink: '/signup?plan=pro',
  },
  {
    name: 'Enterprise',
    price: 'Sur mesure',
    period: '',
    description: 'Grandes structures et intégrations avancées.',
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
    ctaLink: 'mailto:team@stockflow.grandigix.com',
  },
]

const faqs = [
  {
    question: 'Puis-je changer de plan à tout moment ?',
    answer:
      'Oui, vous pouvez passer à un plan supérieur ou inférieur depuis les paramètres de votre organisation.',
  },
  {
    question: 'Le plan Gratuit est-il limité dans le temps ?',
    answer: 'Non, il reste gratuit tant que vous restez dans les limites indiquées.',
  },
  {
    question: 'Quels modes de paiement acceptez-vous ?',
    answer:
      'Nous acceptons les paiements par carte bancaire, virement et mobile money selon les régions.',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main>
        <section className="px-4 py-20 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Des tarifs simples et évolutifs
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Choisissez le plan adapté à votre activité. Tous les plans payants incluent 14 jours
              d’essai.
            </p>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-4">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                    plan.highlighted
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'bg-background'
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Le plus populaire
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="mt-8 w-full"
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    <Link to={plan.ctaLink}>{plan.cta}</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Questions fréquentes sur les tarifs
            </h2>
            <div className="space-y-6">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl border bg-background p-6">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-2xl bg-primary p-8 text-primary-foreground sm:p-12">
            <h2 className="text-3xl font-bold">Besoin d’un devis personnalisé ?</h2>
            <p className="mt-4 opacity-90">
              Contactez notre équipe pour un accompagnement sur mesure, un SLA ou un déploiement
              dédié.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8 gap-2">
              <Link to="mailto:team@stockflow.grandigix.com">
                Nous contacter <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
