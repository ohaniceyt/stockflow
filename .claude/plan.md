# Plan : finalisation MVP multi-locations + offline-first

## Objectif

Durcir le MVP pour qu’il supporte vraiment le multi-locations, les transferts entre emplacements, et fonctionne de manière fiable en mode offline-first.

---

## Phase 1 — Correction base de données multi-locations

### Problème
La contrainte `one_default_per_org UNIQUE (org_id, is_default)` empêche d’avoir plus d’un emplacement non-défaut par organisation.

### Solution
Nouvelle migration `00000000000012_fix_locations_default_constraint.sql` :

```sql
-- Supprimer la contrainte unique incorrecte
ALTER TABLE locations DROP CONSTRAINT IF EXISTS one_default_per_org;

-- Index partiel : un seul emplacement par défaut par org, mais autant de non-défauts que nécessaire
CREATE UNIQUE INDEX one_default_per_org ON locations(org_id) WHERE is_default = TRUE;
```

### Déploiement
```bash
npx supabase db push
```

---

## Phase 2 — Page de gestion des emplacements

### Fichiers à créer

- `src/features/locations/components/LocationForm.tsx`
- `src/features/locations/components/LocationList.tsx`
- `src/features/locations/pages/LocationsPage.tsx`
- `src/features/locations/schemas/locationSchema.ts`

### Fichiers à modifier

- `src/features/locations/services/locationService.ts` : ajouter `createLocation`, `updateLocation`, `setDefaultLocation`.
- `src/features/locations/hooks/useLocations.ts` : ajouter les mutations correspondantes.
- `src/App.tsx` : ajouter la route `/locations` accessible à `super_admin`/`admin`.
- `src/components/layout/AppLayout.tsx` : ajouter un lien "Emplacements" dans la navigation.

### Comportement attendu
- Liste des emplacements de l’org.
- Ajouter un emplacement (nom, description, adresse).
- Définir un emplacement comme défaut (met à jour `is_default` des autres).
- L’emplacement par défaut ne peut pas être supprimé.
- Mise à jour du cache local après chaque mutation.

---

## Phase 3 — Offline-first robuste

### 3.1 Nettoyer le doublon Dexie

- Supprimer `src/db/localDb.ts` (non utilisé, conflit potentiel avec `src/lib/db.ts`).
- Vérifier qu’aucun import ne pointe vers `src/db/localDb.ts`.

### 3.2 Uniformiser les types de la queue

- `PendingOperation.createdAt` est déclaré `string` dans `src/types/index.ts` mais stocké `number` dans Dexie.
- **Décision** : utiliser `number` (timestamp) partout pour les opérations en file.
- Modifier `src/types/index.ts` : `createdAt: number` dans `PendingOperation`.
- Modifier `src/features/offline/services/queueService.ts` pour ne plus convertir.

### 3.3 Pull sync complet au login

- Créer `src/features/offline/services/syncService.ts` avec :
  - `pullSync(orgId)` : fetch products, locations, stockLevels, movements, inventorySessions, inventoryCounts et les met en cache Dexie.
- Appeler `pullSync` après connexion réussie dans `src/features/auth/context/AuthContext.tsx`.
- Appeler `pullSync` au reconnect dans `src/features/offline/hooks/useSync.ts` avant le push.

### 3.4 Cacher toutes les données critiques

- `useLocations` : `cacheLocations` après fetch.
- `useMovements` : `cacheMovements` après fetch.
- `useInventory` : `cacheInventorySessions` + `cacheInventoryCounts` après fetch.
- Fallback offline dans chaque hook (`getCachedXxx`).

### 3.5 Router toutes les mutations offline vers la queue

| Mutation | Action hors ligne |
|---|---|
| `useCreateProduct` | `queueOperation({ type: 'PRODUCT_CREATE', payload: { orgId, input } })` |
| `useUpdateProduct` | `queueOperation({ type: 'PRODUCT_UPDATE', payload: { id, input } })` |
| `useCreateMovement` (page Mouvements) | `queueOperation({ type: 'MOVEMENT', payload })` |
| `useCreateInventorySession` | `queueOperation({ type: 'INVENTORY_SESSION_CREATE', payload })` |
| `useUpdateCount` | `queueOperation({ type: 'INVENTORY_COUNT_UPDATE', payload })` |

### 3.6 Étendre `executeOperation` dans `useSync.ts`

- Ajouter les handlers pour `PRODUCT_UPDATE`, `INVENTORY_SESSION_CREATE`, `INVENTORY_COUNT_UPDATE`.
- Créer un service `inventoryService.ts` côté client pour les appels synchrones si nécessaire.

### 3.7 Retry intelligent

- Constantes : `MAX_RETRIES = 5`, `BACKOFF_BASE_MS = 1000`.
- Une opération `failed` avec `retryCount >= MAX_RETRIES` passe en statut `dead` et n’est plus retentée automatiquement.
- Backoff exponentiel : attendre `BACKOFF_BASE_MS * 2^retryCount` avant le prochain essai (implémenté via timestamp `nextRetryAt`).
- Afficher les opérations en échec dans `OfflineStatus` avec bouton "Réessayer" / "Supprimer".

### 3.8 Valider les payloads de la queue

- Créer `src/features/offline/schemas/operationSchema.ts` avec Zod pour chaque type d’opération.
- Dans `executeOperation`, valider le payload avant exécution.
- En cas de payload invalide, marquer `dead` avec message explicite.

### 3.9 Mise à jour du schéma Dexie

- Passer `src/lib/db.ts` à `version(2)` pour supporter les nouveaux champs (`nextRetryAt`, `error`).
- Index supplémentaire : `pendingOperations: 'id, type, status, createdAt, nextRetryAt'`.

---

## Phase 4 — Transfert rapide dans le stock (P1)

### Fichiers à modifier

- `src/features/stock/components/QuickMovementDialog.tsx` : accepter `'TRANSFER'` et demander l’emplacement cible.
- `src/features/stock/pages/StockPage.tsx` : ajouter une action "Transférer" qui ouvre le dialog.
- `src/features/stock/services/stockService.ts` : `recordMovement` supporte déjà `TRANSFER`.

### Comportement
- Depuis la liste de stock, l’utilisateur clique "Transférer" sur une ligne.
- Dialogue : quantité + emplacement cible (liste des autres locations de l’org).
- Envoie un mouvement `TRANSFER` via la queue offline si hors ligne.

---

## Phase 5 — Tests & validation

### À faire après chaque phase
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- Smoke test sur `https://stockflow.grandigix.com`

### Smoke test final attendu
1. Créer 2 emplacements.
2. Créer un produit avec prix d’achat/vente.
3. Faire un mouvement `IN` dans l’emplacement A.
4. Faire un `TRANSFER` de A vers B.
5. Passer en offline (DevTools → Network → Offline).
6. Créer un produit → vérifier qu’il apparaît localement.
7. Faire un mouvement `OUT` → vérifier l’impact local.
8. Repasser online → vérifier que la queue se synchronise.
9. Rafraîchir → vérifier que les données sont persistées côté serveur.

---

## Ordre d’exécution

1. Phase 1 (migration BDD).
2. Phase 2 (page locations).
3. Phase 3.1 + 3.2 (cleanup + types).
4. Phase 3.3 + 3.4 (pull sync + cache complet).
5. Phase 3.5 + 3.6 (queue pour toutes les mutations).
6. Phase 3.7 + 3.8 (retry + validation).
7. Phase 4 (transfert rapide).
8. Phase 5 (tests + smoke).

---

## Risques & décisions

| Risque | Mitigation |
|---|---|
| Migration BDD sur données existantes | Test local avec `supabase db reset` avant push |
| Conflits de sync (même produit modifié offline par 2 utilisateurs) | Dernier écrit gagne pour l’instant ; conflits manuels plus tard |
| Perte d’opérations en file d’attente | Statut `dead` visible + bouton réessayer |
| Performance du pull sync sur gros volume | Pagination future si besoin ; MVP volume faible |
