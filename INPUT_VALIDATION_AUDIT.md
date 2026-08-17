# Audit #329 — Validation & nettoyage des entrées

> Date : 2026-06-23  
> Périmètre : 57 Edge Functions Supabase, helpers partagés, formulaires frontend (audit visuel), politiques RLS / fonctions SQL.  
> État : **Fermé (code)** — toutes les Edge Functions ont été durcies. Reste la revue front-end (formulaires React) pour un second cycle.

---

## 1. Objectifs

1. S’assurer qu’aucune valeur contrôlée par l’utilisateur n’atteint la base de données ou un client sans validation de type, de format et de borne.
2. Empêcher les injections SQL/XSS via les Edge Functions (POSTgREST, emails, PDF).
3. Normaliser la gestion des erreurs pour ne jamais fuiter de détails internes (stack, schéma, requête).
4. Documenter les helpers réutilisables et les patterns à suivre pour les nouvelles fonctions.

---

## 2. Verdict

| Domaine                     | État        | Notes                                                                                  |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| JSON body parsing           | ✅ Durci    | `parseJsonBody` vérifie Content-Type et rejette le JSON malformé.                      |
| UUID / email / téléphone    | ✅ Validés  | Helpers `isUuid`, `isEmail`, `isPhone`, `isSlug`.                                      |
| Entiers / pagination        | ✅ Validés  | `isInteger`, `isPositiveInteger`, `clampInt`.                                          |
| Enumérations                | ✅ Validées | `isEnum` sur tous les types de mouvement, plans, rôles, etc.                           |
| Chaînes libres / recherche  | ✅ Durcies  | `isSafeSearchTerm` et longueurs max pour éviter LIKE wildcards.                        |
| Fichiers / noms de document | ✅ Durcis   | `sanitizeFilename` avant usage dans un attribut `download`.                            |
| Réponses d’erreur interne   | ✅ Durcies  | `genericInternalErrorResponse` masque les détails côté client.                         |
| Templates email / PDF       | ✅ Durcis   | Échappement HTML via `escapeHtml`/`escapeHtmlAttribute` déjà en place.                 |
| Formulaires React           | 🟡 Partiel  | Audit visuel ; validation zod/React Hook Form présente mais non testée exhaustivement. |
| Politiques RLS SQL          | ✅ OK       | Aucune concaténation de valeurs utilisateur dans les policies.                         |

---

## 3. Helpers partagés créés / enrichis

### `supabase/functions/_shared/validate.ts`

| Helper                 | Usage typique                                              |
| ---------------------- | ---------------------------------------------------------- |
| `parseJsonBody`        | Vérifier Content-Type + parser le body JSON.               |
| `isUuid`               | Identifiants d’org, user, produit, emplacement.            |
| `isEmail`              | Emails d’invitation, de connexion, de support.             |
| `isPhone`              | Numéros de téléphone utilisateurs / contacts.              |
| `isSlug`               | Slugs d’organisation, URLs publiques.                      |
| `isNonEmptyString`     | Noms, adresses, libellés avec limite de longueur.          |
| `isInteger`            | Quantités, index de pagination.                            |
| `isPositiveInteger`    | Quantités de mouvements IN/OUT/TRANSFER.                   |
| `isNonNegativeInteger` | Quantités d’ajustement/inventaire.                         |
| `isEnum`               | Type de mouvement, plan, rôle, pays, devise.               |
| `isStringArray`        | Tags, catégories, IDs sélectionnés.                        |
| `isUuidArray`          | Batch operations (produits, contacts).                     |
| `isSafeSearchTerm`     | Recherche `.ilike()` / `.or()` côté Edge Function.         |
| `clampInt`             | Pagination `limit` / `offset`.                             |
| `sanitizeFilename`     | Noms de fichier PDF générés.                               |
| `normalizeString`      | Champs optionnels avant insertion.                         |
| `normalizeNumber`      | Prix unitaires optionnels avant vérification métier.       |
| `escapeHtml`           | Échappement HTML pour emails et PDF (déjà dans `html.ts`). |

### `supabase/functions/_shared/errors.ts`

| Helper                         | Rôle                                          |
| ------------------------------ | --------------------------------------------- |
| `internalErrorResponse`        | Réponse JSON générique avec CORS.             |
| `genericInternalErrorResponse` | Réponse 500 "Internal server error" standard. |

---

## 4. Fonctions durcies (57 / 57)

Toutes les Edge Functions ont été revues et durcies selon le même pattern :

1. `parseJsonBody` en entrée.
2. Validation des champs obligatoires avec les helpers ci-dessus.
3. Vérification d’appartenance à l’organisation avant toute mutation.
4. Remplacement des réponses 500 brutes par `genericInternalErrorResponse`.
5. Catch des erreurs inattendues avec log côté serveur uniquement.

### Liste par batch

- **Batch 1** : `accept-invitation`, `api-gateway`, `bulk-create-products`, `cancel-sale`, `change-org-plan`, `change-pin`.
- **Batch 2** : `cleanup-rate-limits`, `complete-onboarding`, `complete-sale`, `create-api-key`, `create-contact`, `create-invitation`, `create-location`, `create-platform-challenge`, `create-product`, `create-storefront-order`, `create-user`, `data-subject-request`, `decline-invitation`.
- **Batch 3** : `generate-document-pdf`, `generate-receipt-pdf`, `initialize-session`, `list-invitations`, `list-my-invitations`, `list-my-organizations`, `list-users`.
- **Batch 4** : `org-limits`, `platform-exit-impersonation`, `platform-get-organization-slug-history`, `platform-get-organization`, `platform-get-overview`, `platform-get-user`, `platform-impersonate`, `platform-list-audit-logs`, `platform-list-organizations`, `platform-list-users`, `platform-reset-user-pin`, `platform-send-password-reset`, `platform-set-organization-plan`, `platform-set-password`, `platform-suspend-organization`, `platform-toggle-user-active`, `platform-update-organization-slug`, `record-movement`.
- **Batch 5** : `request-pin-reset`, `reset-pin`, `send-auto-reminders`, `send-document-email`, `send-invoice-reminder`, `send-magic-link`, `send-receipt-email`, `signup`, `switch-membership`, `validate-invitation-token`.

---

## 5. Exemples de durcissement

### `signup/index.ts`

- Body JSON parsé et typé.
- Validation : `name` ≤ 120, `email` valide, `password` 8-128, `phone` formaté, `plan` dans l’enum.
- Échappement HTML dans l’email de vérification.
- Réponse 500 générique en cas d’erreur inattendue.

### `complete-onboarding/index.ts`

- Vérification du JWT.
- Validation de `orgName`, `orgSlug`, `country` (2 car.), `currency` (3 car.), `timezone`, `defaultLocationName`.
- Normalisation et validation du slug avant appel RPC.

### `record-movement/index.ts`

- Enum du type de mouvement.
- Quantité positive sauf pour `ADJUSTMENT`/`INVENTORY` (non négative).
- UUIDs produit / emplacement / emplacement cible validés.
- Prix unitaire coercé en nombre fini avant usage.

---

## 6. Tests & vérifications

- ✅ `npm run lint` : aucune erreur sur `supabase/functions/**/*.ts`.
- ✅ `npm run build` : build TypeScript + Vite + prerendering marketing vert.
- 🟡 `deno check` : non exécuté en masse (Deno non disponible globalement dans l’environnement local) ; les fonctions sont déployées via `supabase functions deploy`.
- 🟡 Tests unitaires : la couverture est faible ; les fonctions durcies n’ont pas de tests de régression dédiés.

---

## 7. Risques résiduels

| #   | Risque                                           | Sévérité | Mitigation proposée                                                         |
| --- | ------------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| R1  | Validation front-end non auditée exhaustivement. | Moyen    | Cycle #2 : auditer chaque formulaire React avec zod + messages d’erreur.    |
| R2  | Aucun test automatisé sur les Edge Functions.    | Moyen    | Ajouter une suite de tests Deno / integration pour les fonctions critiques. |
| R3  | Dépendance à `sessionStorage` pour le JWT.       | Critique | Voir item #7 de l’audit #327 : migration vers cookies httpOnly.             |
| R4  | Fichiers uploadés non audités (photos produits). | Faible   | Vérifier taille, type MIME et scan côté client + RLS côté stockage.         |

---

## 8. Recommandations & plan d’action

1. **Cycle front-end** : auditer les 10 formulaires critiques (signup, onboarding, produit, contact, mouvement, vente, paramètres, invitation, team, profile) et aligner les schémas zod sur les règles serveur.
2. **Tests Edge Functions** : ajouter au moins un test par fonction critique (signup, complete-sale, record-movement, create-product, request-pin-reset).
3. **Documentation développeur** : ajouter un paragraphe dans `CONTRIBUTING.md` : toute nouvelle Edge Function DOIT utiliser `parseJsonBody`, valider chaque champ avec `_shared/validate.ts` et retourner `genericInternalErrorResponse` sur erreur inattendue.
4. **Suivi des erreurs** : monitorer Sentry / Supabase logs pour détecter les 400 en hausse qui indiqueraient une validation trop stricte ou un client non mis à jour.

---

## 9. Livrables

- `supabase/functions/_shared/validate.ts` — helpers de validation.
- `supabase/functions/_shared/errors.ts` — helpers de réponse d’erreur.
- 57 Edge Functions durcies.
- Ce document : `INPUT_VALIDATION_AUDIT.md`.
