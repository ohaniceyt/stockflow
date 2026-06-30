# Plan de refonte UI StockFlow

## 1. Objectif et diagnostic

### 1.1 Objectif principal
Transformer l’expérience visuelle de StockFlow en une interface cohérente, lisible et scalable sur desktop, tablette et mobile, depuis la landing page jusqu’au POS.

### 1.2 Diagnostic rapide du code actuel
- **Deux familles de tokens en concurrence** : shadcn (`bg-card`, `text-foreground`, `text-muted-foreground`, `border`, etc.) et des tokens SaaS customs (`--surface`, `--surface-2`, `--text`, `--text-faint`, `--text-h`, `--r-md`, etc.).
- **Polices/typographie** : `html { font-size: 18px; line-height: 1.65 }` est correct, mais le rendu est encore dense car beaucoup de cartes, de formulaires et de champs sont empilés sans hiérarchie aérienne.
- **Composants hybrides** : certains écrans utilisent `Button` shadcn, d’autres des boutons customs `.btn-o`/`.btn-p`. Idem pour les badges : `Badge` shadcn vs utilitaires `.bd-g`/`.bd-y`/`.bd-r`.
- **Layouts en carton** : toutes les pages sont des `space-y-4` ou `space-y-6` sans sections de page, sans en-tête normalisé, sans gestion cohérente des états vides/skeletons.
- **Navigation** : sidebar de 64 icônes, items non regroupés, labels longs, icônes de 4 px. L’espace est gaspillé et la scalabilité limitée.
- **Densité** : OrganisationPage est un mur de formulaires dans une seule colonne de `max-w-3xl`. Dashboard superpose jusqu’à 7 sections.
- **Landing / App disconnect** : la landing utilise des sections marketing modernes (max-w-7xl, grands titres, cards avec ombre), tandis que l’app reste dans un style SaaS 2022.

## 2. Principes directeurs du redesign

1. **Un seul langage visuel** : tout part de shadcn Tailwind v4, on supprime les utilitaires custom à moyen terme.
2. **Hiérarchie claire** : page → section → card → champ. Toujours un `PageHeader` normalisé.
3. **Respiration** : plus de padding, de l’espace entre les sections, moins de bordures en cascade.
4. **Mobile-first / POS-first** : les interfaces opérationnelles (caisse, inventaire, mouvements) doivent être utilisables à une main et en plein soleil.
5. **Accessibilité** : contraste, zones tactiles min 44 px, focus visible, aria-labels, skeletons.
6. **Données d’abord** : dashboard et analytics doivent faire ressortir les chiffres et alertes, pas les contrôles.
7. **Progressif** : la migration se fait par modules, pas en un seul Big Bang.

## 3. Design System unifié

### 3.1 Fondation

#### Palette (reposée sur shadcn, mais plus soft)
Les variables existantes restent, on les enrichit juste et on standardise l’usage.

```css
:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --border: #e2e8f0;
  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --accent: #eff6ff;
  --destructive: #ef4444;
  --radius: 0.75rem;

  /* Status tokens (à utiliser via variables CSS, pas des classes custom) */
  --status-success: #10b981;
  --status-success-bg: #d1fae5;
  --status-warning: #f59e0b;
  --status-warning-bg: #fef3c7;
  --status-danger: #e11d48;
  --status-danger-bg: #ffe4e6;
  --status-info: #4f46e5;
  --status-info-bg: #e0e7ff;
}
```

#### Typographie
- Base conservée : `font-size: 18px; line-height: 1.6`.
- Échelle : `xs: 0.75rem (12px)`, `sm: 0.875rem (14px)`, `base: 1rem (16px)`, `lg: 1.125rem (18px)`, `xl: 1.25rem (20px)`, `2xl: 1.5rem (24px)`, `3xl: 1.875rem (30px)`, `4xl: 2.25rem (36px)`.
- Titres de page : `text-2xl font-semibold tracking-tight`.
- Sous-titre de page : `text-base text-muted-foreground`.
- Titres de card : `text-sm font-semibold` ou `text-base font-semibold`.

#### Spacing
- Page padding : `p-4 md:p-6 lg:p-8`.
- Section gap : `gap-6 md:gap-8`.
- Card padding : `p-5 md:p-6`.
- Internal card gap : `space-y-4`.

### 3.2 Composants fondamentaux (à créer / normaliser)

#### `PageHeader`
```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: string;
}
```

Utilisé sur chaque page :
- `Dashboard` : titre "Tableau de bord", actions refresh + date.
- `Stock` : titre "Stock", actions export + partage.
- `Products` : titre "Produits", actions import + nouveau.

#### `PageSection`
Encadre un bloc thématique avec un titre optionnel.

```tsx
<PageSection title="Flux des 7 derniers jours">
  <DashboardFluxChart ... />
</PageSection>
```

#### `DataCard`
Version unifiée des stat cards du dashboard et stock cards.
```tsx
<DataCard
  label="Ruptures"
  value="12"
  subtitle="Produits épuisés"
  icon={AlertTriangle}
  status="danger"
  trend={{ value: -2, label: "vs semaine dernière" }}
/>
```

#### `EmptyState`
```tsx
<EmptyState
  icon={Package}
  title="Aucun produit"
  description="Créez votre premier produit pour commencer à suivre le stock."
  action={<Button>Nouveau produit</Button>}
/>
```

#### `StatusBadge`
Remplace `Badge` shadcn + `.bd-*`.
```tsx
<StatusBadge variant="success | warning | danger | info | neutral">OK</StatusBadge>
```

### 3.3 Layouts

#### Sidebar redessinée
- Largeur : `w-[240px]`.
- Header compact : logo + nom org + rôle.
- Groupes de navigation :
  - **Principal** : Dashboard, Stock, Analytics, Mouvements, Caisse, Inventaire.
  - **Catalogue** : Produits, Emplacements, Fournisseurs, Clients.
  - **Admin** : Équipe, Facturation, Store, Réglages, Back Office.
- Icônes 5 px avec espacement 14 px.
- Active state : fond `bg-primary/10`, texte `text-primary`, bordure gauche 3 px.
- Bouton déconnexion en bas.

#### Topbar redessinée
- Sticky, hauteur `h-16`.
- À gauche : hamburger mobile + breadcrumb.
- À droite : recherche globale, notifications, org switcher, profil.
- Suppression du titre "StockFlow" redondant.

## 4. Mockups / structure des pages clés

### 4.1 Layout global (desktop)

```
+-------------------------------------------------------------+
| [≡] Dashboard / Stock        [🔍] [🔔] [Org ▼] [Profile ▼]   |  h-16 topbar
+---------------+---------------------------------------------+
|               |                                             |
|   STOCKFLOW   |  PageHeader                                 |
|   ┌───┐       |  ┌─────────────────────────────────────┐    |
|   │ ■ │       |  │ Titre de page          [Action] [+] │    |
|   └───┘       |  └─────────────────────────────────────┘    |
|   Mon org     |                                             |
|   Admin       |  PageSection                                |
|               |  ┌─────────────────────────────────────┐    |
| ▸ Dashboard   |  │ Titre de section                    │    |
| ▸ Stock       |  │                                     │    |
| ▸ Analytics   |  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │    |
| ▸ Mouvements  |  │ │   │ │ │   │ │ │   │ │ │   │   │    |
| ▸ Caisse      |  │ └─────┘ └─────┘ └─────┘ └─────┘   │    |
| ▸ Inventaire  |  └─────────────────────────────────────┘    |
|               |                                             |
| ─ Catalogue   |  PageSection                                  |
| ▸ Produits    |  ┌─────────────────────────────────────┐    |
| ▸ Emplacement |  │                                     │    |
| ▸ Fournisseur |  │                                     │    |
| ▸ Clients     |  │                                     │    |
|               |  └─────────────────────────────────────┘    |
| ─ Admin       |                                             |
| ▸ Équipe      |                                             |
| ▸ Facturation |                                             |
| ▸ Réglages    |                                             |
|               |                                             |
| [Déconnexion] |                                             |
+---------------+---------------------------------------------+
```

### 4.2 Dashboard redessiné

```
+---------------------------------------------------------+
| Tableau de bord              [Rafraîchir] [Aujourd'hui] |
+---------------------------------------------------------+
|                                                         |
|  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                    |
|  │ 1   │  │ 12  │  │ 8   │  │ 245 │                    |
|  │Rupt.│  │Alert│  │Qté  │  │Prod.│                    |
|  └─────┘  └─────┘  └─────┘  └─────┘                    |
|                                                         |
|  ┌─────────────────────────────────────┐               |
|  │ Flux 7 jours                        │               |
|  │                                     │               |
|  │          [~~~~ graph ~~~~]          │               |
|  │                                     │               |
|  └─────────────────────────────────────┘               |
|                                                         |
|  ┌───────────────────┐ ┌───────────────────┐         |
|  │ Top produits      │ │ Rotation du stock │         |
|  │                   │ │                   │         |
|  └───────────────────┘ └───────────────────┘         |
|                                                         |
|  ┌───────────────────┐ ┌───────────────────┐         |
|  │ Alertes stock     │ │ Derniers mouvements│         |
|  │                   │ │                   │         |
|  └───────────────────┘ └───────────────────┘         |
|                                                         |
+---------------------------------------------------------+
```

### 4.3 Stock redessiné (grille denses, adaptée POS)

```
+---------------------------------------------------------+
| Stock          [PDF] [Excel] [WhatsApp] [↻ Rafraîchir] |
+---------------------------------------------------------+
| [🔍 Rechercher par nom, catégorie ou référence...]      |
+---------------------------------------------------------+
|  142 produits en stock                                  |
+---------------------------------------------------------+
|                                                         |
|  ┌────────────┐  ┌────────────┐  ┌────────────┐      |
|  │ Coca 33cl  │  │ Riz 5kg    │  │ Savon      │      |
|  │ Boissons   │  │ Alimentaire│  │ Hygiène    │      |
|  │            │  │            │  │            │      |
|  │   142      │  │    24      │  │     8      │      |
|  │ unités     │  │  sacs      │  │  unités    │      |
|  │            │  │            │  │            │      |
|  │ [▓▓▓▓▓░░]  │  │ [▓▓▓░░░░░] │  │ [▓░░░░░░░] │      |
|  │ mini: 20   │  │ mini: 10   │  │ mini: 5    │      |
|  └────────────┘  └────────────┘  └────────────┘      |
|                                                         |
+---------------------------------------------------------+
```

### 4.4 Organisation / Réglages redessiné

Objectif : casser le mur de formulaires en onglets thématiques.

```
+---------------------------------------------------------+
| Paramètres                                              |
+---------------------------------------------------------+
| [ Organisation ] [ Fonctionnalités ] [ Facturation ]   |
| [ Emplacements ] [ Store ]                            |
+---------------------------------------------------------+
|                                                         |
|  ┌─────────────────────────────────────────────────┐    |
|  │  🏢 Organisation                                  │    |
|  │  Nom, identifiant, pays, devise et fuseau.        │    |
|  │                                                   │    |
|  │  Nom *  [Ma Boutique.......................]      │    |
|  │  Slug   [ma-boutique.......................]     │    |
|  │  Pays   [v Côte d'Ivoire....................]     │    |
|  │  Devise [v XOF..............................]     │    |
|  │  Fuseau [v Africa/Abidjan....................]     │    |
|  │                                                   │    |
|  │              [ Enregistrer ]                      │    |
|  └─────────────────────────────────────────────────┘    |
|                                                         |
+---------------------------------------------------------+
```

### 4.5 Caisse / POS redessiné

```
+---------------------------------------------------------+
| Ma Boutique  |  Magasin principal  |  [Session] [Panier 3] |
+---------------------------------------------------------+
|  Emplacement: [v Magasin principal]   |  Caisse ouverte     |
|  Client:      [v Client comptant]     |  Recette: 24 500    |
+---------------------------------------------------------+
|                                                         |
|  Produits                              |  Panier          |
|  [🔍 Coca...]                          |                  |
|                                        |  Coca 33cl  x2   |
|  ┌────────┐ ┌────────┐ ┌────────┐     |  Riz 5kg    x1   |
|  │ Coca   │ │ Riz    │ │ Savon  │     |                  |
|  │ 500 F  │ │ 2500 F │ │ 300 F  │     |  Sous-total  3500|
|  └────────┘ └────────┘ └────────┘     |  Taxes        0  |
|                                        |  TOTAL       3500  |
|  [Scanner]  [Categories ▼]             |                  |
|                                        |  [Payer]         |
|                                        |                  |
+---------------------------------------------------------+
```

### 4.6 Landing page
Conserver la direction actuelle mais aligner la palette avec l’app (mêmes bleus, mêmes rayons, mêmes tailles). L’objectif est que le passage landing → signup → dashboard soit fluide.

## 5. Architecture de migration

### 5.1 Phase 1 : Fondations (semaine 1)
- Créer `src/components/layout/PageHeader.tsx`, `PageSection.tsx`, `DataCard.tsx`, `EmptyState.tsx`, `StatusBadge.tsx`.
- Créer `src/components/layout/Sidebar.tsx`, `Topbar.tsx`, `MobileNav.tsx` unifiés.
- Refactoriser `navConfig.ts` avec des groupes.
- Nettoyer `index.css` : déprécier `.btn-*`, `.bd-*`, `.card-t`, etc., et documenter les remplacements.
- Mise à jour de `AppLayout.tsx` pour utiliser Sidebar + Topbar.

### 5.2 Phase 2 : Pages clés (semaines 2–3)
- Refondre `DashboardPage.tsx` et ses composants (stat cards, alertes, graphiques).
- Refondre `StockPage.tsx`, `StockHeader.tsx`, `StockCard.tsx`, `StockGrid.tsx`.
- Refondre `ProductsPage.tsx` et extraire `ProductList` / `CategoryList` avec `DataTable`.
- Refondre `OrganizationPage.tsx` en onglets thématiques.

### 5.3 Phase 3 : Flux opérationnels (semaines 4–5)
- Refondre `MovementsPage.tsx` : liste + formulaire full-width.
- Refondre `InvoicingPage.tsx` : overview, listes, formulaire de création.
- Refondre `CashierWorkspace.tsx` et POS.
- Refondre `OnboardingPage.tsx` avec un stepper horizontal et des cards d’étapes.

### 5.4 Phase 4 : Auth, settings secondaires, back-office (semaine 6)
- Refondre `LoginPage`, `SignupPage`, forgot/reset pages.
- Refondre `ProfilePage`, `TeamPage`, `LocationsPage`, `SubscriptionPage`, `ApiKeysPage`.
- Refondre `BackOfficeLayout` et pages back-office.

### 5.5 Phase 5 : Polish, dark mode, landing (semaine 7)

#### Objectifs
1. Rendre le dark mode utilisable dans l’app (toggle + respect du système) et cohérent sur le marketing.
2. Harmoniser la landing page avec le design system (couleurs, espacements, accessibilité, images).
3. Atteindre les scores Lighthouse : Performance ≥ 95, Accessibilité ≥ 95, Best Practices 100.
4. Audit responsive rapide sur iPhone SE, iPad et desktop 1440.

#### Décisions techniques
- **Thème** : ajouter un `ThemeProvider` léger avec trois modes (`light`, `dark`, `system`), persistance `localStorage`, et synchronisation de la classe `dark` sur `<html>`. Le mode par défaut est `system`. Cela permet de vérifier les deux modes sans attendre la préférence OS.
- **Marketing** : la landing reste en mode `system` (pas de sélecteur dans le header). On ajoute un petit script inline dans `index.html` pour éviter le flash de contenu clair (FOUC) au chargement.
- **Tokens legacy** : on conserve les utilitaires dépréciés mais on ajoute leurs valeurs dark dans le bloc `.dark` de `index.css` pour ne pas casser les écrans qui les utilisent encore (filet de sécurité).
- **Status / DataCard** : on enrichit `StatusBadge` et `DataCard` avec des variantes `dark:` (ex. `dark:bg-emerald-950 dark:text-emerald-300`) pour garder un contraste correct en mode sombre.
- **Performance** : on ne réécrit pas l’architecture. On ajoute des `preload` pour la police et l’image hero, on vérifie que les chunks lourds (`exceljs`, `jspdf`, `recharts`, `html2canvas`) sont bien lazy‑loadés par les routes actuelles, et on supprime les imports synchrones inutiles.
- **Accessibilité** : audit manuel + `eslint-plugin-jsx-a11y`. On corrige les contrastes, les `alt` manquants, les liens sans label explicite et les contrastes des badges statut.

#### Fichiers à modifier / créer
- **Nouveau** `src/lib/ThemeProvider.tsx` : contexte + `useTheme` + script d’hydratation.
- **Nouveau** `src/components/ThemeToggle.tsx` : bouton à placer dans `Topbar` et dans `ProfilePage`.
- `src/index.css` : ajouter les dark tokens legacy et les variantes dark pour les statuts.
- `src/main.tsx` et `src/landing.tsx` : wrapper avec `ThemeProvider`.
- `index.html` et `app.html` : script anti‑FOUC + `preload` font + hero image.
- `src/components/design-system/StatusBadge.tsx` + `DataCard.tsx` : variantes dark.
- `src/components/layout/Topbar.tsx` : intégrer le `ThemeToggle`.
- `src/features/settings/pages/ProfilePage.tsx` : section Apparence avec toggle et explication.
- `src/features/marketing/components/*.tsx` : revue des contrastes, fallback images, balises sémantiques, headings.
- `src/features/marketing/pages/LandingPage.tsx` : harmonisation section workflow / sécurité avec `PageSection` si pertinent, pas de changement structurel lourd.
- `package.json` : éventuellement script `lighthouse` ou `lighthouse:ci` pour reproduire les audits.

#### Déroulé
1. **Fondations thème** : créer `ThemeProvider`, `ThemeToggle`, mettre à jour `index.css`, éviter le FOUC.
2. **Design System dark** : ajuster `StatusBadge` et `DataCard` pour le mode sombre.
3. **App integration** : ajouter le toggle dans `Topbar` + `ProfilePage`.
4. **Landing polish** : vérifier chaque section marketing, contrastes, `alt`, tailles de zones tactiles.
5. **Performance / Lighthouse** : `npm run build && npm run preview`, lancer Lighthouse desktop & mobile, corriger les points de baisse (images, polices, chunks, rendu bloquant).
6. **Accessibilité** : `npm run lint`, vérifier axe-core via Playwright ou manuel, corriger les alertes.
7. **Validation finale** : `npm run lint && npm run build` passe, Lighthouse atteint les seuils cibles.

#### Critères d’acceptation
- `npm run lint && npm run build` passe sans erreur.
- Le toggle dark/light/system fonctionne dans l’app et la préférence persiste.
- Aucun FOUC visible au rechargement de page dans l’app ni sur la landing.
- Lighthouse (desktop et mobile, incognito, build de production) atteint :
  - Performance ≥ 95
  - Accessibilité ≥ 95
  - Best Practices 100
- Toutes les images marketing ont un `alt` pertinent.
- Les couleurs statut restent lisibles en dark mode.

## 6. Décisions techniques

### 6.1 Conserver ou supprimer
| Existant | Décision |
|----------|----------|
| Tailwind CSS v4 + `@theme inline` | Conserver |
| shadcn Button, Dialog, Tabs, Input, Select, Label | Conserver, normaliser les variantes |
| Custom `.btn-o`, `.btn-p`, `.btn-sm`, `.btn-ic` | Déprécier, migrer vers `Button` shadcn |
| Custom `.bd-g`, `.bd-y`, `.bd-r` | Supprimer, remplacer par `StatusBadge` |
| Custom `.card`, `.sc`, `.sk`, `.card-t` | Déprécier, remplacer par `PageSection` / cards shadcn |
| Custom `--surface`, `--surface-2`, `--text`, `--text-faint`, `--text-h` | Déprécier progressivement au profit de `--card`, `--card-foreground`, `--muted-foreground` |
| Custom `--r-md`, `--shadow-xs` | Remplacer par `--radius-*` Tailwind et `shadow-sm` |
| Utility `.sg` (stat grid) | Remplacer par une variante de `DataCard` |

### 6.2 Composants à ajouter au Design System
```
src/components/design-system/
  ├── PageHeader.tsx
  ├── PageSection.tsx
  ├── DataCard.tsx
  ├── EmptyState.tsx
  ├── StatusBadge.tsx
  ├── Sidebar.tsx
  ├── Topbar.tsx
  ├── MobileNav.tsx
  ├── CommandPalette.tsx (future recherche globale)
  └── DataTable.tsx (abstraction de table/liste)
```

### 6.3 Tokens de couleur des statuts
Remplacer les utilitaires `.ca`, `.cr`, `.cy` par des classes Tailwind pures :
- `bg-emerald-100 text-emerald-700` → OK
- `bg-amber-100 text-amber-700` → Alerte
- `bg-rose-100 text-rose-700` → Danger
- `bg-indigo-100 text-indigo-700` → Info

## 7. Livrables attendus

1. Fichiers de design system dans `src/components/design-system/`.
2. Fichier de migration `UI_REDESIGN_MIGRATION.md` dans `docs/` avec checklist page par page.
3. Story/usage examples dans `src/components/design-system/README.md`.
4. Pull request par phase, chacune testée et déployable.
5. Audit final Lighthouse + screenshots responsive.

## 8. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Régression mobile | Tester chaque phase sur iPhone SE et iPad |
| Incohérence temporaire | Accepter une période de transition, documenter les utilitaires dépréciés |
| Performances | Pas d’ajout de librairie lourde, rester sur Tailwind + composants légers |
| Temps de migration long | Découpage en 7 semaines, validation utilisateur à chaque phase |

## 9. Première étape immédiate

Commencer par la **Phase 1** : créer `PageHeader`, `PageSection`, `DataCard`, `EmptyState`, `StatusBadge`, puis réécrire `AppLayout` avec une nouvelle Sidebar/Topbar. Cela donne le squelette global et permet de valider le look & feel avant de toucher aux flux.

## 10. Questions à valider

1. **Validez-vous la direction visuelle générale** (sidebar groupée + topbar sticky + cards aérées) ?
2. **Souhaitez-vous un dark mode opérationnel** dès le début ou seulement en phase 5 ?
3. **Préférez-vous un système de toast global** ou rester sur des messages d’erreur inline dans les formulaires ?
4. **Le POS actuel est-il prioritaire** dans la refonte, ou peut-il attendre la phase 3 ?
5. **Quel est le budget temps réel** : est-ce que le découpage 7 semaines est acceptable, ou faut-il livrer un MVP en 2 semaines ?
