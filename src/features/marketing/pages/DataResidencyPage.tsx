import { LegalPage } from '../components/LegalPage'

export default function DataResidencyPage() {
  return (
    <LegalPage title="Hébergement et résidence des données" lastUpdated="23 juin 2026">
      <p>
        StockFlow est conçu pour les PME africaines. Cette page détaille où résident vos données,
        quels sous-traitants sont impliqués et quelles mesures nous prenons pour maîtriser la
        souveraineté des données.
      </p>

      <h2>1. Infrastructures et régions</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 font-medium">Composant</th>
            <th className="py-2 font-medium">Fournisseur</th>
            <th className="py-2 font-medium">Région</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2">Base de données, auth, stockage, Edge Functions</td>
            <td>Supabase</td>
            <td>
              <code>eu-central-1</code> (Francfort, DE)
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2">Frontend et CDN</td>
            <td>Vercel</td>
            <td>Réseau Edge global (principalement EU / US)</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">Emails transactionnels</td>
            <td>Resend</td>
            <td>États-Unis</td>
          </tr>
        </tbody>
      </table>

      <h2>2. Pourquoi Francfort aujourd’hui ?</h2>
      <p>
        Supabase ne propose pas encore de région africaine couvrant durablement notre zone de
        déploiement. Nous avons choisi <code>eu-central-1</code> pour sa proximité réseau avec
        l’Afrique de l’Ouest, sa conformité GDPR et la stabilité de son SLA, en attendant une région
        africaine généralement disponible.
      </p>

      <h2>3. Engagements</h2>
      <ul>
        <li>
          Nous ne vendons ni ne partageons vos données avec des tiers au-delà des sous-traitants
          strictement nécessaires listés ci-dessus.
        </li>
        <li>
          Dès qu’une région africaine Supabase adaptée sera disponible, nous planifierons une
          migration de la base de données métier et d’authentification.
        </li>
        <li>
          Les données sont chiffrées en transit (TLS 1.2+) et au repos par nos fournisseurs cloud.
        </li>
      </ul>

      <h2>4. Conservation et effacement</h2>
      <p>
        Voir notre <a href="/privacy">Politique de confidentialité</a>. Vous pouvez demander
        l’export ou la suppression de vos données en écrivant à{' '}
        <a href="mailto:team@stockflow.grandigix.com">team@stockflow.grandigix.com</a>.
      </p>
    </LegalPage>
  )
}
