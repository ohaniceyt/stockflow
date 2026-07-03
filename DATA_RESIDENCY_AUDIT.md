# Audit Data Residency — StockFlow vNext

> Date : 2026-06-23  
> Statut : À traiter — aucune configuration de data residency actuellement en place.

---

## 1. Inventaire des infrastructures et régions

| Composant                    | Fournisseur | Région actuelle                                         | Données hébergées                                  | Remarques                                                     |
| ---------------------------- | ----------- | ------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| **Base de données Postgres** | Supabase    | `eu-central-1` (Francfort, DE)                          | Données métier, auth, audit logs, fichiers storage | Région choisie lors de la création du projet.                 |
| **Auth / GoTrue**            | Supabase    | `eu-central-1`                                          | Identités, tokens, métadonnées MFA                 | Même région que la DB.                                        |
| **Storage**                  | Supabase    | `eu-central-1`                                          | Factures PDF, reçus, documents                     | Stockage objet lié au projet.                                 |
| **Edge Functions**           | Supabase    | `eu-central-1`                                          | Logique métier, secrets Edge                       | Exécution proche de la DB.                                    |
| **Frontend / Edge CDN**      | Vercel      | USA par défaut (Washington D.C. pour les builds `iad1`) | Assets statiques, HTML, JS, CSS                    | Vercel ne garantit pas une région unique pour le trafic edge. |
| **Emails transactionnels**   | Resend      | USA (région non configurable au niveau projet)          | Contenu des emails envoyés                         | Données temporaires en transit.                               |

**Projet Supabase** : `ngdvmodloxuvrdjjzxel` — `stockflow` — région `eu-central-1`.

---

## 2. Constat : non-conformité avec la cible africaine

L'application cible les **PME africaines** et mentionne "RGPD-ready" / conformité sur le marketing. Or :

- La base de données et l'authentification résident en **Europe (Francfort)**.
- Aucune **région africaine** (ex. `af-south-1` Johannesburg, ou futur `af-north-1`) n'est utilisée.
- Aucun **clauses de sous-traitance** / DPA (Data Processing Addendum) n'est documenté.
- Aucune mention des régions dans les **pages légales** (`/privacy`, `/terms`).

> Score Sécurité & Compliance audit : Résidence des données **3/10**.

---

## 3. Risques identifiés

| Risque                                                 | Impact                                                          | Sévérité |
| ------------------------------------------------------ | --------------------------------------------------------------- | -------- |
| Données clients africains stockées en Europe           | Latence, problèmes de souveraineté, obligations légales locales | Moyen    |
| Absence de DPA / sous-traitants documentés             | Non-conformité RGPD / lois locales data protection              | Haut     |
| CDN Vercel sans région maîtrisée                       | Cache et logs potentiellement aux USA                           | Moyen    |
| Resend sans garantie de région                         | Emails et métadonnées hors UE/Afrique                           | Faible   |
| Aucune stratégie de backup / restauration géographique | RPO/RTO non définis                                             | Moyen    |
| Absence de politique de rétention                      | Stockage indéfini des logs / mouvements                         | Moyen    |

---

## 4. Recommandations

### 4.1 Court terme (documentation)

1. **Mettre à jour `/privacy`** pour indiquer :
   - Fournisseurs : Supabase (EU), Vercel (global), Resend (USA).
   - Région principale de stockage : `eu-central-1`.
   - Absence actuelle de région africaine.
   - Droit d'accès/rectification/effacement (contact DPO).
2. **Documenter la data residency** dans ce fichier (`DATA_RESIDENCY_AUDIT.md`) et maintenir à jour.
3. **Définir une politique de rétention** des données dans Supabase (logs, mouvements, inactifs).

### 4.2 Moyen terme (configuration)

1. **Évaluer une migration Supabase vers une région africaine** dès disponible :
   - Surveiller `af-south-1` (Johannesburg) ou toute région africaine future.
   - Noter : la migration de projet Supabase nécessite un nouveau projet + dump/restore + rotation des clés.
2. **Activer Vercel Edge Config / Functions sur une région maîtrisée** si Vercel propose un pinning régional pour le traffic africain.
3. **Configurer Resend** avec un domaine et une région compatible (actuellement non gérable côté projet).

### 4.3 Long terme (architecture)

1. **Séparer les données par juridiction** si l'application s'étend à plusieurs pays africains.
2. **Mettre en place un processus DPA** avec Supabase et Vercel.
3. **Auditer régulièrement** la data residency (trimestriel).

---

## 5. Actions immédiates proposées

- [ ] Modifier `src/features/marketing/pages/PrivacyPage.tsx` pour documenter hébergeurs et régions.
- [ ] Ajouter une section "Hébergement et données" dans `README.md`.
- [ ] Nettoyer la référence obsolète `stockflow-ruby.vercel.app` dans `supabase/config.toml`.
- [ ] Créer un ticket interne pour étudier la migration vers une région africaine.
- [ ] Définir une politique de rétention des `activity_logs`, `login_attempts`, `api_request_logs`.

---

## 6. Références

- Supabase regions : https://supabase.com/docs/guides/platform/regions
- Vercel Edge Network : https://vercel.com/docs/edge-network/overview
- RGPD Article 44-49 : transferts internationaux de données.
