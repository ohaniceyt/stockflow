import { LegalPage } from '../components/LegalPage'

export default function CookiesPage() {
  return (
    <LegalPage title="Politique de cookies" lastUpdated="23 juin 2026">
      <p>
        StockFlow utilise des cookies et technologies similaires pour assurer le bon fonctionnement
        du service et améliorer votre expérience.
      </p>

      <h2>1. Qu’est-ce qu’un cookie ?</h2>
      <p>
        Un cookie est un petit fichier texte déposé sur votre terminal lors de la visite d’un site.
        Il permet de mémoriser des informations utiles pour la navigation et les préférences.
      </p>

      <h2>2. Cookies strictement nécessaires</h2>
      <p>
        Ces cookies sont indispensables au fonctionnement du service. Ils permettent
        l’authentification, la sécurité de la session et la gestion du panier de vente. Ils ne
        peuvent pas être désactivés.
      </p>

      <h2>3. Cookies de performance et d’analyse</h2>
      <p>
        Nous utilisons des cookies de mesure d’audience pour comprendre comment le service est
        utilisé et l’améliorer. Ces cookies sont déposés uniquement avec votre consentement.
      </p>

      <h2>4. Cookies tiers</h2>
      <p>
        StockFlow s’appuie sur des services tiers (Supabase, Vercel, Resend). Ces services peuvent
        déposer des cookies techniques nécessaires à leur fonction. Nous ne vendons pas vos données
        à des tiers.
      </p>

      <h2>5. Gestion des cookies</h2>
      <p>
        Vous pouvez configurer votre navigateur pour refuser les cookies. Toutefois, le refus des
        cookies nécessaires peut empêcher l’utilisation de certaines fonctionnalités de StockFlow.
      </p>

      <h2>6. Durée de conservation</h2>
      <p>
        Les cookies de session sont supprimés à la fermeture du navigateur. Les cookies persistants
        sont conservés pour une durée maximale de 13 mois, conformément aux recommandations de la
        CNIL.
      </p>

      <h2>7. Contact</h2>
      <p>
        Pour toute question concernant cette politique, contactez-nous à{' '}
        <a href="mailto:team@stockflow.grandigix.com">team@stockflow.grandigix.com</a>.
      </p>
    </LegalPage>
  )
}
