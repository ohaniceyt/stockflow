import { FileText, Mail, Bell, Repeat, Calculator, CheckCircle } from 'lucide-react'
import { FeaturePage } from '../components/FeaturePage'

export default function InvoicingFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Facturation"
      title="Devis et factures qui donnent une image professionnelle"
      description="Créez des devis, convertissez-les en factures, suivez les paiements et relancez automatiquement vos clients en retard."
      primaryCta="Créer ma première facture"
      primaryCtaLink="/signup"
      secondaryCta="Voir les tarifs"
      secondaryCtaLink="/pricing"
      previewLabel="Aperçu de l’éditeur de factures"
      features={[
        {
          icon: FileText,
          title: 'Devis & factures',
          description: 'Modèles clairs, personnalisables et conformes aux usages locaux.',
        },
        {
          icon: Repeat,
          title: 'Conversion devis → facture',
          description: 'Transformez un devis accepté en facture en un clic.',
        },
        {
          icon: Mail,
          title: 'Envoi par email',
          description: 'Envoyez directement vos documents à vos clients.',
        },
        {
          icon: Bell,
          title: 'Rappels automatiques',
          description: 'Programmez des relances pour les factures impayées.',
        },
        {
          icon: Calculator,
          title: 'Taxes et remises',
          description: 'Appliquez des taxes, remises et acomptes facilement.',
        },
        {
          icon: CheckCircle,
          title: 'Suivi des paiements',
          description: 'Visualisez les factures payées, en retard et en attente.',
        },
      ]}
    />
  )
}
