import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Box,
  Check,
  Clock,
  Lock,
  MapPin,
  Package,
  Shield,
  Smartphone,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeatureCard } from '../components/FeatureCard'
import { PricingCard } from '../components/PricingCard'

const features = [
  {
    icon: Package,
    title: 'Catalogue produits',
    description: 'Gérez vos produits, catégories, seuils de stock et codes-barres en un seul endroit.',
  },
  {
    icon: MapPin,
    title: 'Multi-emplacements',
    description: 'Suivez le stock dans plusieurs entrepôts, boutiques ou zones de stockage.',
  },
  {
    icon: ArrowRight,
    title: 'Mouvements fluides',
    description: 'Entrées, sorties, transferts, ajustements et inventaires — tout est tracé.',
  },
  {
    icon: Smartphone,
    title: 'Offline-first',
    description: 'Continuez à travailler hors ligne : les données se synchronisent automatiquement.',
  },
  {
    icon: Users,
    title: 'Équipe structurée',
    description: 'Rôles (super admin, admin, opérateur, lecteur) et invitations par email sécurisées.',
  },
  {
    icon: BarChart3,
    title: 'Tableau de bord',
    description: 'Visualisez les stocks faibles, les mouvements du jour et les tendances clés.',
  },
  {
    icon: Shield,
    title: 'Sécurité par PIN',
    description: 'Authentification par PIN + magic link pour un accès rapide et sécurisé.',
  },
  {
    icon: Zap,
    title: 'Rapide à déployer',
    description: 'Créez votre organisation en quelques clics et commencez à gérer votre stock.',
  },
]

const pricingPlans = [
  {
    name: 'Gratuit',
    description: 'Parfait pour tester StockFlow',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      '2 utilisateurs',
      '50 produits',
      '1 emplacement',
      '100 mouvements/mois',
      'Support email',
    ],
    cta: 'Commencer gratuitement',
    href: '/signup?plan=free',
  },
  {
    name: 'Starter',
    description: 'Petites équipes et boutiques',
    monthlyPrice: 4900,
    yearlyPrice: 49900,
    features: [
      '5 utilisateurs',
      '500 produits',
      '3 emplacements',
      '2 000 mouvements/mois',
      'Support prioritaire',
    ],
    cta: 'Essai 14 jours',
    href: '/signup?plan=starter',
    highlighted: true,
    popular: true,
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
      'Accès API',
      'Support dédié',
    ],
    cta: 'Essai 14 jours',
    href: '/signup?plan=pro',
  },
  {
    name: 'Enterprise',
    description: 'Sur mesure',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Utilisateurs illimités',
      'Produits illimités',
      'Emplacements illimités',
      'Mouvements illimités',
      'API + SLA',
      'Support sur mesure',
    ],
    cta: 'Contacter l\'équipe',
    href: 'mailto:team@stockflow.grandigix.com',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              S
            </div>
            StockFlow
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#features" className="text-muted-foreground hover:text-foreground">
              Fonctionnalités
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground">
              Tarifs
            </a>
            <a href="#security" className="text-muted-foreground hover:text-foreground">
              Sécurité
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/login')}>
              Se connecter
            </Button>
            <Button size="sm" onClick={() => (window.location.href = '/signup')}>
              S'inscrire
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              La gestion de stock{' '}
              <span className="text-primary">simple et moderne</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              StockFlow vNext aide les PME, boutiques et entrepôts à suivre leurs produits,
              leurs emplacements et leurs mouvements en temps réel — même hors ligne.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" onClick={() => (window.location.href = '/signup')}>
                Créer un compte gratuit
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => (window.location.href = '/login')}
              >
                Se connecter
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-primary" />
                Essai gratuit 14 jours
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-primary" />
                Pas de carte bancaire
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-primary" />
                Annulation à tout moment
              </span>
            </div>
          </div>
        </section>

        <section id="features" className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold">Tout ce qu'il faut pour gérer votre stock</h2>
              <p className="mt-4 text-muted-foreground">
                Un outil pensé pour les équipes opérationnelles, pas pour les tableurs.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold">Sécurisé et fiable</h2>
                <p className="mt-4 text-muted-foreground">
                  Vos données sont isolées par organisation, protégées par authentification
                  robuste et stockées sur une infrastructure moderne.
                </p>
                <ul className="mt-6 space-y-4">
                  {[
                    { icon: Lock, text: 'Authentification par PIN + magic link' },
                    { icon: Shield, text: 'Isolation des données par organisation' },
                    { icon: Clock, text: 'Journal des connexions et rate limiting' },
                    { icon: Box, text: 'Sauvegardes et synchronisation automatique' },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="space-y-4">
                  {[
                    { label: 'Disponibilité', value: '99.9%' },
                    { label: 'Données chiffrées', value: 'TLS' },
                    { label: 'Backups', value: 'Automatiques' },
                    { label: 'Conformité', value: 'RGPD-ready' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center justify-between rounded-xl border bg-background p-4"
                    >
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                      <span className="font-semibold">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold">Des tarifs clairs</h2>
              <p className="mt-4 text-muted-foreground">
                Commencez gratuitement, évoluez selon vos besoins.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {pricingPlans.map((plan) => (
                <PricingCard key={plan.name} {...plan} />
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-2xl bg-primary p-8 text-center text-primary-foreground sm:p-12">
            <h2 className="text-3xl font-bold">Prêt à simplifier votre stock ?</h2>
            <p className="mx-auto mt-4 max-w-xl opacity-90">
              Rejoignez les équipes qui gagnent du temps chaque jour avec StockFlow vNext.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                variant="secondary"
                onClick={() => (window.location.href = '/signup')}
              >
                Créer mon compte
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => (window.location.href = '/login')}
              >
                Se connecter
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} StockFlow vNext. Tous droits réservés.</p>
          <div className="flex gap-6">
            <a href="mailto:team@stockflow.grandigix.com" className="hover:text-foreground">
              Contact
            </a>
            <Link to="/login" className="hover:text-foreground">
              Connexion
            </Link>
            <Link to="/signup" className="hover:text-foreground">
              Inscription
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
