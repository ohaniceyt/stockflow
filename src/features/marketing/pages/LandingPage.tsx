import {
  BarChart3,
  BookOpen,
  Box,
  Calculator,
  Clock,
  Globe,
  HelpCircle,
  Lock,
  MapPin,
  Package,
  Receipt,
  Shield,
  Smartphone,
  Store,
  Users,
  Video,
  WifiOff,
} from 'lucide-react'
import { TopBanner } from '../components/TopBanner'
import { MarketingHeader } from '../components/MarketingHeader'
import { HeroSection } from '../components/HeroSection'
import { TrustBanner } from '../components/TrustBanner'
import { SocialProof } from '../components/SocialProof'
import { FeatureBlock } from '../components/FeatureBlock'
import { FeatureGrid } from '../components/FeatureGrid'
import { MidBanner } from '../components/MidBanner'
import { PricingSection } from '../components/PricingSection'
import { ResourceHub } from '../components/ResourceHub'
import { FaqSection } from '../components/FaqSection'
import { FinalCta } from '../components/FinalCta'
import { MarketingFooter } from '../components/MarketingFooter'

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
    icon: Box,
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
    title: 'Tableau de bord & analytics',
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
      'Enregistrez les mouvements, vendez en caisse et suivez votre activité.'
  },
]

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
      'API + storefront',
      'Support dédié',
    ],
    cta: '1 mois gratuit',
    href: '/signup?plan=pro',
    highlighted: true,
    popular: true,
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
    href: 'mailto:team@flowbill.grandigix.com',
  },
]

const faqs = [
  {
    question: 'StockFlow fonctionne-t-il hors connexion ?',
    answer:
      'Oui. L’application est conçue offline-first : vous pouvez vendre, ajuster le stock et enregistrer des mouvements même sans internet. Les données se synchronisent automatiquement dès le retour en ligne.',
  },
  {
    question: 'Puis-je connecter StockFlow à mes autres outils ?',
    answer:
      'Oui. StockFlow expose une API sécurisée avec clés API et webhooks. Vous pouvez l’intégrer à votre comptabilité, votre site e-commerce ou tout autre service compatible REST.',
  },
  {
    question: 'Quels modes de paiement sont acceptés en caisse ?',
    answer:
      'La caisse supporte le cash, la carte bancaire, le mobile money et les paiements mixtes. Chaque vente génère un reçu et met à jour le stock en temps réel.',
  },
  {
    question: 'Comment sont protégées mes données ?',
    answer:
      'Vos données sont isolées par organisation grâce à Supabase RLS, l’authentification repose sur JWT, et l’application supporte un AppLock PIN local. Les échanges sont chiffrés en TLS.',
  },
  {
    question: 'Puis-je essayer avant de payer ?',
    answer:
      'Oui, chaque plan payant inclut 1 mois d’essai gratuit. Aucune carte bancaire n’est requise, et vous pouvez résilier à tout moment.',
  },
]

const resources = [
  {
    icon: BookOpen,
    title: 'Guide de démarrage',
    description: 'Configurez votre stock, vos emplacements et votre première vente en 15 minutes.',
    href: '#',
  },
  {
    icon: Video,
    title: 'Tutoriels vidéo',
    description:
      'Courtes vidéos pratiques pour maîtriser la caisse et les rapports.',
    href: '#',
  },
  {
    icon: Calculator,
    title: 'Modèles Excel',
    description: 'Importez rapidement votre catalogue avec nos modèles prêts à l’emploi.',
    href: '#',
  },
  {
    icon: HelpCircle,
    title: 'Centre d’aide',
    description: 'Réponses détaillées aux questions les plus fréquentes et bonnes pratiques.',
    href: '#',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBanner />
      <MarketingHeader />

      <main>
        <HeroSection />
        <TrustBanner />
        <SocialProof />

        <FeatureBlock
          icon={Package}
          eyebrow="Gestion de stock"
          title="Maîtrisez chaque produit, chaque emplacement"
          description="Suivez votre inventaire en temps réel, recevez des alertes de stock faible et gérez plusieurs entrepôts ou boutiques depuis un seul tableau de bord."
          bullets={[
            'Réduisez les ruptures de stock grâce aux alertes automatiques',
            'Gérez plusieurs entrepôts ou boutiques en temps réel',
            'Retracez chaque mouvement jusqu’à l’opérateur',
            'Gagnez du temps lors des inventaires périodiques',
          ]}
          image="/features/inventory-preview.png"
          imageAlt="Aperçu de la gestion de stock"
          link="/features/inventory"
          linkLabel="Découvrir la gestion de stock"
        />

        <FeatureBlock
          icon={Receipt}
          reversed
          eyebrow="Caisse & POS"
          title="Vendez plus vite et encaissez sans friction"
          description="Transformez n’importe quel appareil en caisse. Scannez, encaissez, imprimez des reçus et synchronisez automatiquement le stock."
          bullets={[
            'Accélérez vos ventes avec le scan code-barres',
            'Encaissez cash, carte ou mobile money sans friction',
            'Imprimez ou partagez des reçus professionnels',
            'Gardez le contrôle sur les annulations et les retours',
          ]}
          image="/features/pos-preview.png"
          imageAlt="Aperçu de la caisse"
          link="/features/pos-cashier"
          linkLabel="Découvrir la caisse"
        />

        <FeatureGrid
          title="Tout ce qu’il faut pour gérer votre activité"
          subtitle="Des fonctionnalités pensées ensemble pour fluidifier votre quotidien de bout en bout."
          items={features.slice(0, 6)}
        />

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
                  <p className="text-base text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <MidBanner />

        <PricingSection
          tiers={pricingPlans.map((p) => ({
            name: p.name,
            price:
              p.priceMode === 'custom'
                ? 'Sur mesure'
                : `${(p.monthlyPrice / 100).toLocaleString('fr-FR')} €`,
            period: p.priceMode === 'custom' ? '' : '/mois',
            description: p.description,
            features: p.features,
            cta: p.cta,
            ctaLink: p.href,
            highlighted: p.highlighted,
            yearlyPrice: p.yearlyPrice,
          }))}
        />

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
                      <span className="text-base font-medium">{text}</span>
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
                      <span className="text-base text-muted-foreground">{stat.label}</span>
                      <span className="font-semibold">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <ResourceHub resources={resources} />

        <FaqSection faqs={faqs} />

        <FinalCta />
      </main>

      <MarketingFooter />
    </div>
  )
}
