import { WifiOff, RotateCcw, ShieldCheck, Clock, Cloud, Zap } from 'lucide-react'
import { FeaturePage } from '../components/FeaturePage'

export default function OfflineFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Mode offline"
      title="Vendez et gérez votre stock, même sans connexion"
      description="StockFlow fonctionne hors ligne. Vos ventes, mouvements et ajustements sont enregistrés localement puis synchronisés dès le retour du réseau."
      primaryCta="Essayer 1 mois gratuit"
      primaryCtaLink="/signup"
      secondaryCta="Voir les tarifs"
      secondaryCtaLink="/pricing"
      previewLabel="Synchronisation automatique en arrière-plan"
      previewIcon={WifiOff}
      features={[
        {
          icon: WifiOff,
          title: 'Travail hors ligne natif',
          description: 'Continuez à vendre et gérer le stock sans internet.',
        },
        {
          icon: RotateCcw,
          title: 'Synchronisation intelligente',
          description: 'Les données locales remontent automatiquement au retour en ligne.',
        },
        {
          icon: ShieldCheck,
          title: 'Détection de conflits',
          description: 'StockFlow détecte les conflits et vous aide à les résoudre.',
        },
        {
          icon: Clock,
          title: 'File d’attente locale',
          description: 'Vos actions sont conservées en file d’attente tant que le réseau manque.',
        },
        {
          icon: Cloud,
          title: 'Backup automatique',
          description: 'Les données synchronisées sont sauvegardées sur le cloud.',
        },
        {
          icon: Zap,
          title: 'Performance locale',
          description: 'Interface réactive grâce au stockage local optimisé.',
        },
      ]}
      benefits={[
        'Ne perdez plus de ventes à cause du réseau',
        'Travaillez dans les zones rurales',
        'Synchronisez automatiquement au retour en ligne',
        'Gardez vos données en sécurité',
      ]}
    />
  )
}
