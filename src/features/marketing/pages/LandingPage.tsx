import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Box,
  Check,
  Clock,
  CreditCard,
  FileText,
  Globe,
  LayoutDashboard,
  Lock,
  MapPin,
  Package,
  Receipt,
  Shield,
  Smartphone,
  Store,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeatureCard } from '../components/FeatureCard'
import { PricingCard } from '../components/PricingCard'

const features = [
  {
    icon: Package,
    title: 'Catalogue produits',
    description:
      'Produits illimités, catégories, codes-barres, prix d’achat, prix de vente et seuils d’alerte.',
  },
  {
    icon: MapPin,
    title: 'Multi-emplacements',
    description:
      'Gérez du stock dans plusieurs entrepôts, boutiques ou points de vente en temps réel.',
  },
  {
    icon: ArrowRight,
    title: 'Mouvements traçables',
    description:
      'Entrées, sorties, transferts, ajustements et inventaires — chaque mouvement est horodaté et rattaché à un opérateur.',
  },
  {
    icon: Receipt,
    title: 'Caisse intégrée',
    description:
      'Ventes rapides, impression de reçus, paiements multiples (cash, carte, mobile money) et annulations contrôlées.',
  },
  {
    icon: FileText,
    title: 'Facturation professionnelle',
    description:
      'Devis, factures, bons de livraison, rappels auto et conversion devis → facture avec numérotation personnalisée.',
  },
  {
    icon: WifiOff,
    title: 'Offline-first',
    description:
      'Continuez à vendre et à gérer le stock sans connexion. La synchronisation se fait automatiquement au retour en ligne.',
  },
  {
    icon: Users,
    title: 'Équipe et rôles',
    description:
      'Invitez votre équipe par email, définissez les rôles (admin, opérateur, caissier, lecteur) et gardez le contrôle.',
  },
  {
    icon: Lock,
    title: 'Sécurité moderne',
    description:
      'Authentification email/password Supabase, magic link, AppLock PIN local et isolation des données par organisation.',
  },
  {
    icon: BarChart3,
    title: 'Tableau de bord & recap',
    description:
      'Stocks faibles, mouvements du jour, ventes, impayés et KPIs clairs pour piloter votre activité.',
  },
  {
    icon: Store,
    title: 'Storefront (optionnel)',
    description:
      'Activez une vitrine en ligne pour recevoir des commandes directement rattachées à votre stock.',
  },
  {
    icon: Globe,
    title: 'API & intégrations',
    description:
      'Clés API sécurisées, webhooks et documentation pour connecter StockFlow à vos outils existants.',
  },
  {
    icon: Smartphone,
    title: 'Scan code-barres',
    description:
      'Ajoutez des produits au panier ou recherchez un stock en scannant directement depuis votre appareil.',
  },
]

const workflow = [
  {
    step: '1',
    title: 'Créez votre organisation',
    description: 'Choisissez votre pays, devise et fuseau horaire. Onboarding guidé en 2 minutes.',
  },
  {
    step: '2',
    title: 'Importez votre catalogue',
    description:
      'Ajoutez vos produits manuellement ou par import Excel, définissez les seuils et les emplacements.',
  },
  {
    step: '3',
    title: 'Gérez et vendez',
    description:
      'Enregistrez les mouvements, vendez en caisse, éditez des factures et suivez votre activité.',
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
      'Facturation incluse',
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
      'API + storefront',
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
    priceMode: 'custom' as const,
    features: [
      'Utilisateurs illimités',
      'Produits illimités',
      'Emplacements illimités',
      'Mouvements illimités',
      'API + SLA',
      'Support sur mesure',
    ],
    cta: "Contacter l'équipe",
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
            <a href="#workflow" className="text-muted-foreground hover:text-foreground">
              Comment ça marche
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground">
              Tarifs
            </a>
            <a href="#security" className="text-muted-foreground hover:text-foreground">
              Sécurité
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Se connecter</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">S'inscrire</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          <div className="mx-auto max-w-4xl text-center">
            <span className="mb-4 inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-primary shadow-sm">
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              StockFlow vNext est maintenant disponible
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Gérez votre stock, vos ventes et votre facturation{' '}
              <span className="text-primary">en un seul outil</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              La solution de gestion de stock pensée pour les PME, boutiques et entrepôts en Afrique
              et en Europe. Suivez vos produits en temps réel, vendez en caisse, facturez vos
              clients — même hors connexion.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/signup">
                  Créer un compte gratuit
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/login">Se connecter</Link>
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

        <section className="border-y bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Tableau de bord en temps réel
            </span>
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Paiements mobiles supportés
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Synchronisation automatique
            </span>
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Données isolées par org
            </span>
          </div>
        </section>

        <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold">Une plateforme complète pour vos opérations</h2>
              <p className="mt-4 text-muted-foreground">
                Fini les tableurs éparpillés : stock, ventes, facturation et équipe dans une seule
                interface.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold">Démarrez en 3 étapes</h2>
              <p className="mt-4 text-muted-foreground">
                De l’inscription à la première vente, tout est conçu pour être rapide et intuitif.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              {workflow.map((item) => (
                <div key={item.step} className="relative rounded-2xl border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                    {item.step}
                  </div>
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold">Sécurisé, fiable et RGPD-ready</h2>
                <p className="mt-4 text-muted-foreground">
                  Vos données sont isolées par organisation, protégées par une authentification
                  moderne et stockées sur une infrastructure cloud résiliente.
                </p>
                <ul className="mt-6 space-y-4">
                  {[
                    { icon: Lock, text: 'Authentification email/password + magic link' },
                    { icon: Smartphone, text: 'AppLock PIN local par appareil' },
                    { icon: Shield, text: 'Isolation stricte des données par organisation' },
                    { icon: Clock, text: 'Journal des connexions et rate limiting' },
                    { icon: Box, text: 'Sauvegardes automatiques et synchronisation offline' },
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
                    { label: 'Authentification', value: 'JWT + RLS' },
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
                Commencez gratuitement, évoluez selon vos besoins. Sans engagement.
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
              Rejoignez les équipes qui gagnent du temps chaque jour avec StockFlow vNext. Créez
              votre compte gratuit dès maintenant.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/signup">Créer mon compte</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <Link to="/login">Se connecter</Link>
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
