# Audit sécurité — Contrôle d’accès StockFlow vNext

> Date : 2026-06-23  
> Scope : politiques RLS Supabase, Edge Functions, système de rôles (`UserRole`, `PlatformAdminRole`), guards React, API gateway, impersonation/sudo.  
> Statut : Isolation multi-tenant fonctionnelle mais fragilisée par des politiques RLS sous-spécifiées et des fonctions Edge qui contournent l’isolation avec le service role.

---

## 1. Résumé exécutif

L’isolation entre organisations repose principalement sur **`users.active_org_id`** et sur la fonction `current_user_org_id()`. C’est un **point de défaillance unique** : toute corruption de cette valeur expose toutes les requêtes RLS.

Trois familles de risques dominent :

1. **Fuites cross-tenant** : plusieurs fonctions document/reçu/facture utilisent `adminClient` (service role) sans vérifier que le document appartient à l’organisation de l’appelant.
2. **Élévation de privilèges** : les politiques RLS de `platform_admins`, `organization_memberships`, `users`, `products`, `movements` permettent à des rôles inférieurs d’écrire hors de leur périmètre.
3. **Tables sensibles sans RLS** : `platform_admin_challenges`, `api_request_logs`, et certaines tables métier ont des politiques absentes ou trop larges.

---

## 2. Contrôles positifs

| Domaine                                      | Observation                                                                   | Preuve                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| Vérification du challenge platform-admin     | PBKDF2, sel, comparaison constante, consommation atomique.                    | `_shared/platform.ts`                        |
| Hiérarchie partielle dans les Edge Functions | `create-user` et `reset-pin` empêchent un `admin` de cibler un `super_admin`. | `create-user/index.ts`, `reset-pin/index.ts` |
| Scopes et hashing des clés API               | `api-gateway` vérifie les scopes et compare le hash SHA-256 de la clé.        | `api-gateway/index.ts`                       |
| Guards React                                 | `RequireAuth`, `RequirePlatformAdmin`, `RequireRole` existent côté UI.        | `src/features/auth/components`               |
| RLS activé sur la majorité des tables        | La plupart des tables métier ont `ENABLE ROW LEVEL SECURITY`.                 | Migrations fondation                         |

---

## 3. Politiques RLS par table

### 3.1 `platform_admins` — élévation critique

**Ce qui existe**  
Politique `FOR ALL` utilisant `is_platform_admin()`.

**Risque**  
`is_platform_admin()` retourne vrai pour **tout** admin de plateforme (`super_admin` ou `moderator`). Un `moderator` peut modifier la table et se promouvoir `super_admin`.

| #     | Sévérité     | Problème                                                      | Fichier                                         |
| ----- | ------------ | ------------------------------------------------------------- | ----------------------------------------------- |
| 3.1.1 | **Critique** | `moderator` peut créer/modifier/désactiver des `super_admin`. | `migrations/00000000000013_saas_foundation.sql` |

**Recommandation**  
Restreindre les mutations sur `platform_admins` au rôle `super_admin`.

---

### 3.2 `organization_memberships` — pas de hiérarchie de rôles

**Ce qui existe**  
Politique `FOR ALL` autorisant `super_admin` et `admin` à gérer les membres de l’org active.

**Risque**  
Un `admin` peut se promouvoir `super_admin`, désactiver le propriétaire ou modifier les rôles sans contrainte.

| #     | Sévérité  | Problème                                                          | Fichier                                     |
| ----- | --------- | ----------------------------------------------------------------- | ------------------------------------------- |
| 3.2.1 | **Haute** | Aucune hiérarchie : `admin` == `super_admin` dans les politiques. | `migrations/00000000000016_memberships.sql` |

**Recommandation**

- Un `admin` ne peut pas modifier un `super_admin`.
- Empêcher l’auto-promotion via trigger ou politique.

---

### 3.3 `users` — `WITH CHECK` sous-spécifié

**Ce qui existe**  
La politique `users_org_admin_manage` vérifie l’appartenance en `USING` mais pas en `WITH CHECK`.

**Risque**  
Un administrateur peut modifier un utilisateur sans garantie qu’il reste dans l’organisation courante.

| #     | Sévérité  | Problème                                               | Fichier                                     |
| ----- | --------- | ------------------------------------------------------ | ------------------------------------------- |
| 3.3.1 | **Haute** | `WITH CHECK` ne contraint pas l’`org_id` ni les rôles. | `migrations/00000000000016_memberships.sql` |

**Recommandation**  
Reproduire en `WITH CHECK` les mêmes contraintes qu’en `USING` et restreindre les colonnes modifiables.

---

### 3.4 `products` — INSERT non restreint au rôle

**Ce qui existe**  
Politique `products_org_admin_write` : `USING` vérifie le rôle, `WITH CHECK` vérifie seulement `org_id`.

**Risque**  
Pour un INSERT, seule `WITH CHECK` s’applique. Tout membre actif peut insérer un produit.

| #     | Sévérité  | Problème                                                | Fichier                                     |
| ----- | --------- | ------------------------------------------------------- | ------------------------------------------- |
| 3.4.1 | **Haute** | `WITH CHECK` n’exige pas le rôle `admin`/`super_admin`. | `migrations/00000000000016_memberships.sql` |

**Recommandation**  
Ajouter la vérification de rôle dans `WITH CHECK`.

---

### 3.5 `movements` — INSERT cross-tenant

**Ce qui existe**  
Politique `movements_org_write` pour INSERT vérifie le rôle et l’`operator_id`, mais pas l’`org_id`.

**Risque**  
Un opérateur d’une org A peut injecter un mouvement de stock pour un produit/emplacement de l’org B.

| #     | Sévérité     | Problème                                     | Fichier                                     |
| ----- | ------------ | -------------------------------------------- | ------------------------------------------- |
| 3.5.1 | **Critique** | `WITH CHECK` ne scoppe pas par organisation. | `migrations/00000000000016_memberships.sql` |

**Recommandation**  
Ajouter `org_id = current_user_org_id()` au `WITH CHECK`, ou forcer l’INSERT via la RPC `record_movement` uniquement.

---

### 3.6 `receipts`, `invoices`, `receipt_items`, `invoice_items`, `invoice_sequences` — permissions trop larges

**Ce qui existe**  
Politiques `FOR ALL` autorisant tout membre actif de l’org.

**Risque**  
Un `reader` ou `cashier` peut créer, modifier, supprimer des reçus/factures et les numéros de séquence.

| #     | Sévérité  | Problème                                                               | Fichier                                           |
| ----- | --------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| 3.6.1 | **Haute** | Tout membre actif a INSERT/UPDATE/DELETE sur des documents financiers. | `migrations/00000000000048_invoices_receipts.sql` |

**Recommandation**

- Passer en `FOR SELECT` pour les rôles non privilégiés.
- Réserver les écritures aux rôles autorisés ou à des RPC `SECURITY DEFINER`.
- Rendre les documents financiers immuables hors annulation.

---

### 3.7 `organization_api_keys` — gestion non restreinte

**Ce qui existe**  
Politiques `SELECT`/`UPDATE`/`DELETE` ne requièrent qu’`org_id = current_user_org_id()`.

**Risque**  
Tout membre de l’org peut lire les hashes de clés, les scopes et révoquer les intégrations.

| #     | Sévérité  | Problème                                   | Fichier                                           |
| ----- | --------- | ------------------------------------------ | ------------------------------------------------- |
| 3.7.1 | **Haute** | Aucun rôle requis pour gérer les clés API. | `migrations/00000000000035_org_feature_flags.sql` |

**Recommandation**  
Limiter `SELECT`/`UPDATE`/`DELETE` aux rôles `admin`/`super_admin`.

---

### 3.8 Tables sans RLS explicite

| Table                       | Sévérité  | Problème                                         | Fichier                                                    |
| --------------------------- | --------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `platform_admin_challenges` | **Haute** | Aucune politique RLS définie.                    | `migrations/00000000000042_platform_admin_challenges.sql`  |
| `api_request_logs`          | **Haute** | RLS absente ; contient IPs, chemins et clés API. | `migrations/00000000000040_api_request_logs.sql`           |
| `data_subject_requests`     | Moyenne   | INSERT sans vérification de `org_id`.            | `migrations/20260703010000_data_subject_request_table.sql` |

**Recommandations**

- Activer RLS et scoper l’accès au service-role/propriétaire sur `platform_admin_challenges`.
- Activer RLS sur `api_request_logs` ; accès service-role écriture, admins org/plateforme lecture.
- Ajouter `org_id = current_user_org_id()` à l’insertion de `data_subject_requests`.

---

## 4. Système de rôles et guards frontend

### Ce qui existe

- `UserRole` : `super_admin`, `admin`, `operator`, `cashier`, `reader`.
- `PlatformAdminRole` : `super_admin`, `moderator`.
- `RequireAuth`, `RequirePlatformAdmin`, `RequireRole` côté React.

### Risques

| #   | Sévérité  | Problème                                                                           | Recommandation                                                                    |
| --- | --------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 4.1 | **Haute** | Les guards sont côté client uniquement ; aucun middleware serveur.                 | Ajouter un contrôle côté Edge Function / API pour chaque route sensible.          |
| 4.2 | Moyen     | Les rôles sont stockés dans le state React et déterminés par `initialize-session`. | Re-vérifier le rôle dans chaque appel protégé ; ne pas faire confiance au client. |

---

## 5. Risques cross-organisation

### 5.1 Point de défaillance central : `active_org_id`

Toutes les requêtes authentifiées utilisent `current_user_org_id()` qui lit `users.active_org_id`. Une mise à jour incorrecte de cette valeur expose l’ensemble des requêtes RLS.

### 5.2 Fuites cross-tenant dans les fonctions document

Les fonctions suivantes utilisent `adminClient` (service role) pour lire un document par UUID sans vérifier l’appartenance à l’org de l’appelant :

- `send-receipt-email`
- `generate-receipt-pdf`
- `send-document-email`
- `generate-document-pdf`
- `send-invoice-reminder`

| #   | Sévérité     | Problème                                      | Recommandation                                                                         |
| --- | ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| 5.1 | **Critique** | Lecture cross-tenant de reçus/factures/devis. | Vérifier `org_id` via l’appartenance active de l’appelant avant de servir le document. |

---

## 6. Plateforme admin, sudo et impersonation

### Ce qui existe

- Challenge platform-admin avec PBKDF2, consommation atomique.
- `platform-impersonate`, `platform-suspend-organization`, `platform-exit-impersonation` requièrent `super_admin` + challenge.

### Risques

| #   | Sévérité  | Problème                                                                       | Fichier                                   |
| --- | --------- | ------------------------------------------------------------------------------ | ----------------------------------------- |
| 6.1 | **Haute** | `platform-set-password` requiert `super_admin` mais pas de challenge.          | `platform-set-password/index.ts`          |
| 6.2 | Haute     | `platform-toggle-user-active` accepte `moderator` sans challenge.              | `platform-toggle-user-active/index.ts`    |
| 6.3 | Moyen     | `platform-set-organization-plan` requiert `super_admin` mais pas de challenge. | `platform-set-organization-plan/index.ts` |
| 6.4 | Faible    | L’état sudo est stocké dans `sessionStorage` côté client.                      | `AuthContext.tsx`                         |

**Recommandation**  
Exiger un challenge frais pour toute action platform-admin à fort impact.

---

## 7. Passerelle API et clés API

### Ce qui existe

- Authentification par header `X-StockFlow-API-Key`.
- Vérification des scopes et des `allowed_location_ids`.
- Rate-limit par IP (100 req / 15 min).

### Risques

| #   | Sévérité  | Problème                                                     | Recommandation                                        |
| --- | --------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| 7.1 | **Haute** | Hachage des clés API en SHA-256 non salé.                    | Migrer vers Argon2id ou HMAC-SHA256 avec sel par clé. |
| 7.2 | Moyen     | Aucun rate-limit par clé API.                                | Ajouter un rate-limit par `organization_api_keys.id`. |
| 7.3 | Moyen     | Politiques RLS trop permissives sur `organization_api_keys`. | Restreindre aux rôles `admin`/`super_admin`.          |
| 7.4 | Haute     | `api_request_logs` sans RLS.                                 | Activer RLS et limiter l’accès.                       |

---

## 8. Plan d’action priorisé

### P0 — Bloquant production

1. Restreindre `platform_admins` aux mutations par `super_admin` uniquement.
2. Sceller les fonctions document/reçu/facture contre les fuites cross-tenant.
3. Corriger `movements_org_write` pour scoper par `org_id`.
4. Activer RLS sur `platform_admin_challenges` et `api_request_logs`.

### P1 — Haute priorité

5. Corriger `WITH CHECK` de `users_org_admin_manage`.
6. Corriger `WITH CHECK` de `products_org_admin_write`.
7. Restreindre `organization_memberships` par hiérarchie de rôles.
8. Restreindre `organization_api_keys` aux rôles `admin`/`super_admin`.
9. Réduire les permissions sur `receipts`, `invoices`, `invoice_sequences`.
10. Exiger un challenge pour `platform-set-password`, `platform-toggle-user-active` et `platform-set-organization-plan`.
11. Ajouter `org_id` à la politique d’insertion de `data_subject_requests`.

### P2 — Moyenne / faible priorité

12. Remplacer SHA-256 par un hachage lent et salé pour les clés API.
13. Ajouter un rate-limit par clé API.
14. Ajouter un middleware/Edge Function de contrôle d’accès aux routes.
15. Réduire la dépendance à `active_org_id` en validant l’appartenance dans chaque fonction sensible.
16. Ajouter des tests E2E cross-tenant et d’élévation de rôle.

---

## 9. Conclusion

Le contrôle d’accès de StockFlow vNext est **fonctionnel pour le cas nominal**, mais il manque de durcissement pour les cas antagonistes. Les **fuites cross-tenant** et l’**élévation de privilèges** sont les deux axes à traiter avant toute production multi-organisations.

La priorité absolue est de corriger les fonctions document/reçu/facture et les politiques RLS sur `platform_admins`, `movements`, `organization_memberships`, `users`, `products` et `organization_api_keys`. Une fois ces corrections appliquées, une campagne de tests E2E dédiée (cross-tenant + élévation) doit valider qu’aucune régression n’est introduite.
