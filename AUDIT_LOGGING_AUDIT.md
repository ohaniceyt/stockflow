# Audit — Journalisation et traçabilité (audit logging)

> Date : 2026-06-23
> Scope : `supabase/functions/_shared/audit.ts`, `supabase/functions/*`, `src/types/database.ts`, `supabase/migrations`.
> Statut : Schéma de tables correct, mais le taux de couverture des actions métier critiques est insuffisant et la rétention/gouvernance des logs reste à durcir.

---

## 1. Résumé exécutif

StockFlow dispose de trois tables d'audit :

- `activity_logs` : actions au sein d'une organisation.
- `login_attempts` : tentatives d'authentification (y compris PIN).
- `platform_audit_logs` : actions des administrateurs plateforme.

Le schéma est satisfaisant (timestamps, actor, target, metadata). Les risques principaux sont :

1. **Couverture lacunaire** : seules `complete-sale`, `signup`, `request-pin-reset` et `data-subject-request` écrivent dans `activity_logs`. De nombreuses mutations critiques (produit, mouvement, utilisateur, clé API, changement de plan, annulation de vente…) ne laissent pas de trace durable.
2. **Immunité des logs** : `activity_logs` et `platform_audit_logs` reposent sur le déni implicite de RLS, mais aucune politique explicite n'interdit les mises à jour ou suppressions par un utilisateur authentifié qui parviendrait à contourner le service role.
3. **Rétention** : aucune purge automatique pour `activity_logs` et `platform_audit_logs`. Les volumes peuvent croître indéfiniment.
4. **PII dans les métadonnées** : `platform-send-password-reset` stocke l'email cible dans `metadata`, ce qui complique l'effacement RGPD.
5. **Détail non normalisé** : certains logs placent `ip_address` à l'intérieur de `details`, d'autres dans la colonne dédiée.

---

## 2. Contrôles positifs

| Domaine                | Observation                                                                                | Preuve                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Tables dédiées         | `activity_logs`, `login_attempts`, `platform_audit_logs` existent avec bonne structure.    | Migrations initiales et back-office                                                     |
| RLS activé             | `activity_logs` et `login_attempts` ont RLS activé.                                        | `00000000000001_rls_policies.sql`, `20260629060000_harden_rls.sql`                      |
| Cleanup login attempts | `cleanup-rate-limits` purge les logs de rate-limit et `login_attempts` de plus de 7 jours. | `supabase/functions/cleanup-rate-limits/index.ts`, `.github/workflows/cron-cleanup.yml` |
| Helper centralisé      | `_shared/audit.ts` fournit `logActivity()` et `logLoginAttempt()`.                         | `supabase/functions/_shared/audit.ts`                                                   |
| Logs platform admin    | La plupart des actions back-office sont journalisées dans `platform_audit_logs`.           | Fonctions `platform-*`                                                                  |
| Erreurs logguées       | `logActivity()` loggue les échecs d'insertion côté Edge Function.                          | `supabase/functions/_shared/audit.ts`                                                   |

---

## 3. Couverture des actions métier

### Ce qui est déjà loggué

| Action                                  | Fonction               | Table                 |
| --------------------------------------- | ---------------------- | --------------------- |
| Création de vente / tentative de fraude | `complete-sale`        | `activity_logs`       |
| Inscription                             | `signup`               | `activity_logs`       |
| Demande de reset PIN                    | `request-pin-reset`    | `activity_logs`       |
| Demande RGPD                            | `data-subject-request` | `activity_logs`       |
| Actions back-office                     | fonctions `platform-*` | `platform_audit_logs` |
| Tentatives de connexion                 | `login`                | `login_attempts`      |

### Ce qui n'est pas loggué (P0)

| Action                           | Fonction                                                       | Risque si non tracé                                  |
| -------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Création produit                 | `create-product`, `bulk-create-products`                       | Fraude sur prix/stock, création non autorisée        |
| Mouvement de stock               | `record-movement`                                              | Vol, destruction de stock, manipulation d'inventaire |
| Création utilisateur             | `create-user`                                                  | Élévation de privilèges, comptes fantômes            |
| Invitation / acceptation         | `create-invitation`, `accept-invitation`, `decline-invitation` | Accès non autorisé                                   |
| Création clé API                 | `create-api-key`                                               | Exfiltration potentielle                             |
| Changement de plan               | `change-org-plan`, `platform-set-organization-plan`            | Fraude commerciale                                   |
| Suspension / activation membre   | `platform-toggle-user-active`                                  | Déni de service, accès restauré en cachette          |
| Annulation de vente              | `cancel-sale`                                                  | Effacement de recettes, fraude fiscale               |
| Changement de PIN                | `change-pin`, `reset-pin`                                      | Prise de contrôle de compte                          |
| Changement d'organisation active | `switch-membership`                                            | Cross-tenant access, élévation                       |
| Paramètres organisation          | `complete-onboarding`                                          | Modification de TVA, devise, timezone                |

---

## 4. Risques et recommandations

### 4.1 Couverture lacunaire (P0)

| #     | Sévérité     | Problème                                                                | Preuve                                                     | Recommandation                                                                                                     |
| ----- | ------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 4.1.1 | **Critique** | `create-product` et `bulk-create-products` ne logguent pas la création. | `create-product/index.ts`, `bulk-create-products/index.ts` | Appeler `logActivity()` après insertion avec `action='product_created'`, `target_id`, et les champs prix initiaux. |
| 4.1.2 | **Critique** | `record-movement` ne loggue pas les mouvements de stock.                | `record-movement/index.ts`                                 | Logguer chaque mouvement avec `action='stock_movement'`, type, quantité, produit, emplacement.                     |
| 4.1.3 | **Haut**     | `create-user`, `create-invitation`, `accept-invitation` non tracés.     | Fonctions correspondantes                                  | Logguer création et acceptation d'invitation avec rôle et org.                                                     |
| 4.1.4 | **Haut**     | `create-api-key` ne laisse pas de trace.                                | `create-api-key/index.ts`                                  | Logguer `api_key_created` avec `actor_id` et `org_id` (ne jamais stocker la clé elle-même).                        |
| 4.1.5 | **Haut**     | `cancel-sale` non tracé.                                                | `cancel-sale/index.ts`                                     | Logguer `sale_cancelled` avec raison, montant, recette initiale.                                                   |
| 4.1.6 | Moyen        | `change-pin`, `reset-pin`, `switch-membership` non tracés.              | Fonctions correspondantes                                  | Logguer dans `activity_logs` ou `login_attempts` selon le cas.                                                     |

### 4.2 Gouvernance et rétention (P0/P1)

| #     | Sévérité | Problème                                                                                                                                   | Preuve                                  | Recommandation                                                                                                                                  |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.2.1 | **Haut** | Aucune politique RLS explicite n'interdit les `UPDATE`/`DELETE` sur `activity_logs` et `platform_audit_logs`.                              | Migrations RLS                          | Ajouter des politiques `FOR ALL USING (false)` sur les tables d'audit pour les utilisateurs authentifiés ; seul le service role peut écrire.    |
| 4.2.2 | **Haut** | Pas de purge automatique pour `activity_logs` et `platform_audit_logs` : risque de croissance infinie et de conservation excessive de PII. | Schémas                                 | Ajouter une fonction SQL de purge et un cron (Edge Function ou `pg_cron`) avec une rétention de 90 jours (ajustable selon obligations légales). |
| 4.2.3 | Moyen    | `platform-send-password-reset` stocke l'email cible dans `metadata`.                                                                       | `platform-send-password-reset/index.ts` | Retirer l'email de `metadata` ; utiliser `target_id` (user id).                                                                                 |
| 4.2.4 | Moyen    | `ip_address` parfois dupliquée dans `details` et parfois absente de la colonne dédiée.                                                     | `complete-sale/index.ts`                | Normaliser : capturer l'IP dans la colonne `ip_address`, la retirer de `details`.                                                               |
| 4.2.5 | Moyen    | Les détails JSONB peuvent contenir des PII sans normalisation.                                                                             | `activity_logs.details`                 | Ajouter un helper de sanitisation dans `_shared/audit.ts` qui masque automatiquement les clés sensibles.                                        |

### 4.3 Intégrité et non-répudiation (P1)

| #     | Sévérité | Problème                                                            | Recommandation                                                       |
| ----- | -------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 4.3.1 | Moyen    | Les logs ne sont pas signés ni horodatés de manière externe.        | Envisager un export périodique vers un SIEM / object storage WORM.   |
| 4.3.2 | Moyen    | Le `actor_id` peut être `NULL` si l'appelant n'est pas authentifié. | Accepter `NULL` uniquement pour les actions publiques et documenter. |

---

## 5. Plan d'action

### Immédiat (P0)

1. Ajouter `logActivity()` dans `create-product`, `bulk-create-products`, `record-movement`, `create-user`, `create-invitation`, `accept-invitation`, `decline-invitation`, `create-api-key`, `cancel-sale`, `change-pin`, `reset-pin`, `switch-membership`.
2. Harden RLS sur `activity_logs` et `platform_audit_logs` : politiques explicites de déni total pour `authenticated`.
3. Retirer l'email de `platform-send-password-reset` metadata.

### Court terme (P1)

4. Normaliser `ip_address` dans `complete-sale`.
5. Ajouter `sanitizeDetails()` dans `_shared/audit.ts`.
6. Mettre en place la purge automatique des logs d'audit après 90 jours.

### Moyen terme (P2)

7. Exporter les logs vers un stockage WORM ou SIEM externe.
8. Enrichir les logs avec un hash de chaîne d'intégrité.

---

## 6. Vérifications

Après mise en place :

- [ ] `create-product` écrit un `activity_logs` avec `action='product_created'`.
- [ ] `record-movement` écrit un log pour chaque mouvement.
- [ ] `cancel-sale` écrit un log avec `action='sale_cancelled'`.
- [ ] `authenticated` ne peut ni modifier ni supprimer `activity_logs` / `platform_audit_logs`.
- [ ] Aucune PII directe (email, téléphone) dans `platform_audit_logs.metadata`.
- [ ] La purge automatique fonctionne et respecte la fenêtre de rétention choisie.
