import { BarChart3, TrendingUp, PieChart, Activity, Download, Filter } from 'lucide-react'
import { FeaturePage } from '../components/FeaturePage'

export default function AnalyticsFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Analytics"
      title="Pilotez votre activité avec des chiffres clairs"
      description="Ventes, stock, trésorerie et rentabilité : visualisez l’essentiel en un coup d’œil et prenez les bonnes décisions, sans être expert en tableur."
      primaryCta="Essayer 1 mois gratuit"
      primaryCtaLink="/signup"
      secondaryCta="Voir les tarifs"
      secondaryCtaLink="/pricing"
      previewImage="/dashboard-preview.png"
      previewLabel="Aperçu du tableau de bord analytique"
      previewIcon={BarChart3}
      features={[
        {
          icon: BarChart3,
          title: 'Tableau de bord en temps réel',
          description:
            'Ventes du jour, stock faible, meilleurs produits et mouvements en un clin d’œil.',
        },
        {
          icon: TrendingUp,
          title: 'Tendances de vente',
          description: 'Suivez l’évolution de votre chiffre d’affaires par jour, semaine ou mois.',
        },
        {
          icon: PieChart,
          title: 'Répartition du stock',
          description: 'Visualisez la valorisation et la répartition par catégorie ou emplacement.',
        },
        {
          icon: Activity,
          title: 'KPIs essentiels',
          description: 'Rotation des stocks, panier moyen, marges et rentabilité simplifiées.',
        },
        {
          icon: Filter,
          title: 'Filtres avancés',
          description: 'Segmentez par produit, emplacement, période et utilisateur.',
        },
        {
          icon: Download,
          title: 'Exports',
          description: 'Exportez vos rapports en Excel ou PDF pour votre comptable.',
        },
      ]}
      benefits={[
        'Identifiez les produits les plus rentables',
        'Anticipez les ruptures de stock',
        'Suivez votre trésorerie au jour le jour',
        'Partagez des rapports avec votre comptable',
      ]}
    />
  )
}
