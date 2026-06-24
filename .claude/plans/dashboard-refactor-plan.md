# Plan : refactor de la page Dashboard

## Objectif
Transformer la page `/dashboard` existante en tableau de bord mobile-first, lecture seule, conforme à la spec fournie, en réutilisant l’architecture et les tokens déjà en place.

## Analyse du code actuel
- `DashboardPage.tsx` utilise déjà `useProducts`, `useStock`, `useMovements`, `DashboardStats`, `DashboardChart` et `MovementList`.
- Le graphique actuel est en `recharts` ; la spec impose un canvas 2D manuel.
- Les stat cards actuelles ne correspondent pas aux 4 cartes demandées (Valeur stock, Ruptures, Alertes, Produits).
- L’overlay de détail produit (`StockDetailOverlay`) est déjà refactoré et réutilisable depuis `features/stock`.
- `PullToRefresh` existe dans `features/stock/components`.

## Démarche

### 1. Tokens & classes CSS (`src/index.css`)
Ajouter :
- `--indigo: #4f46e5` et `--indigo-light: #e0e7ff`.
- `@utility sg` (stat grid 2×2).
- `@utility sc` (stat card).
- `@utility ca` / `@utility cr` / `@utility cy` (accent indigo, rose, amber).
- `@utility card-t` (titre de section en card).
- Styles pour `ch-dash` / `ch-trend` : un wrapper responsive et un canvas 2D.
- `@utility dash-empty` (états vides).

### 2. Composants à créer / modifier dans `src/features/dashboard/components/`

#### `DashboardStats.tsx` (modifié)
- 4 cartes `.sc` dans `.sg`.
- Valeur stock : somme `quantity × costPrice`, formaté FCFA, masqué pour non-admin (`hasRole`).
- Ruptures : `quantity <= 0`.
- Alertes : `0 < quantity <= threshold`.
- Produits : nombre de produits actifs.
- Bandeau coloré 2px en haut, label uppercase, grande valeur, sous-label.

#### `DashboardFluxChart.tsx` (nouveau)
- Canvas 2D barres groupées (entrées/sorties) sur 7 derniers jours.
- Axe X `JJ/MM`, légende intégrée.
- Gestion `devicePixelRatio` et resize.

#### `DashboardTrendChart.tsx` (nouveau)
- Toggle 30j / 90j / Personnalisé.
- Canvas 2D courbe/barre des sorties sur la période sélectionnée.
- Boutons `.btn-o` / `.btn-p`.

#### `DashboardTopProducts.tsx` (nouveau)
- Top 5/10 produits les plus vendus (agrégation des mouvements `OUT`).
- Barre de progression relative au max.
- Message vide "Aucune vente enregistrée".

#### `DashboardRotation.tsx` (nouveau)
- Tableau compact : Produit, Sorties, Stock, Rotation (`sorties / stock`).
- Message vide "Données insuffisantes".

#### `DashboardAlerts.tsx` (nouveau)
- Liste des alertes stock (rupture + alerte).
- Badge `.bd-r` / `.bd-y`.
- Clic -> `StockDetailOverlay`.
- Message vert si aucune alerte.

#### `DashboardRecentMovements.tsx` (nouveau)
- Tableau compact Date / Produit / Type / Qté.
- Badges verts/rouges.
- Clic -> `StockDetailOverlay`.
- Tri décroissant.

#### `DashboardHeader.tsx` (nouveau)
- Titre + actions refresh / paramètres / déconnexion ?
- En pratique, réutiliser le pattern du header existant : titre "Tableau de bord", bouton refresh.

### 3. `DashboardPage.tsx` (refactoré)
- Regrouper `stock`, `products`, `movements`.
- Calculer les stats en `useMemo`.
- Rafraîchissement global via `queryClient.invalidateQueries` + `refetch` des 3 hooks.
- Intégrer `PullToRefresh`.
- Empiler verticalement les sections sur mobile.
- Gérer l’état `selectedItem` pour `StockDetailOverlay`.
- Conserver `PinSetupPrompt`.

### 4. Intégrations cross-features
- Importer `StockDetailOverlay` et `PullToRefresh` depuis `features/stock`.
- Utiliser `useAuth().hasRole(['super_admin', 'admin'])` pour masquer la valeur stock.

## Plan d’implémentation (ordre des fichiers)
1. `src/index.css` — ajout des tokens et utilities.
2. `src/features/dashboard/components/DashboardStats.tsx`.
3. `src/features/dashboard/components/DashboardFluxChart.tsx`.
4. `src/features/dashboard/components/DashboardTrendChart.tsx`.
5. `src/features/dashboard/components/DashboardTopProducts.tsx`.
6. `src/features/dashboard/components/DashboardRotation.tsx`.
7. `src/features/dashboard/components/DashboardAlerts.tsx`.
8. `src/features/dashboard/components/DashboardRecentMovements.tsx`.
9. `src/features/dashboard/components/DashboardHeader.tsx`.
10. `src/features/dashboard/pages/DashboardPage.tsx`.
11. Supprimer `DashboardChart.tsx` obsolète.
12. `npm run lint` → `npm run build` → `npm test`.

## Validation
- ESLint propre.
- Build Vite passe (canvas 2D, pas de lib externe).
- Tests unitaires passent.
- Dashboard accessible aux rôles `reader`/`operator`/`admin`.
