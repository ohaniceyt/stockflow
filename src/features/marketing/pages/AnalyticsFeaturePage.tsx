import { BarChart3, TrendingUp, PieChart, Activity, Download, Filter } from 'lucide-react'
import { FeaturePage } from '../components/FeaturePage'

export default function AnalyticsFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Analytics"
      title="Pilotez votre activité avec des données claires"
      description="Tableaux de bord, KPIs, rapports de vente, de stock et de trésorerie : prenez les bonnes décisions basées sur des chiffres actualisés en temps réel."
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
          description: 'Ventes, stocks faibles, impayés et mouvements du jour en un coup d’œil.',
        },
        {
          icon: TrendingUp,
          title: 'Tendances de vente',
          description:
            'Analysez l’évolution de votre chiffre d’affaires sur la période de votre choix.',
        },
        {
          icon: PieChart,
          title: 'Répartition du stock',
          description: 'Visualisez la valorisation et la répartition par catégorie ou emplacement.',
        },
        {
          icon: Activity,
          title: 'KPIs essentiels',
          description: 'Rotation des stocks, panier moyen, marges et rentabilité.',
        },
        {
          icon: Filter,
          title: 'Filtres avancés',
          description: 'Segmentez par produit, emplacement, période et utilisateur.',
        },
        {
          icon: Download,
          title: 'Exports',
          description: 'Exportez vos rapports en Excel ou PDF pour vos comptables.',
        },
      ]}
      benefits={[
        'Identifiez les produits les plus rentables',
        'Anticipez les ruptures de stock',
        'Suivez votre trésorerie',
        'Partagez des rapports avec votre comptable',
      ]}
    />
  )
}
