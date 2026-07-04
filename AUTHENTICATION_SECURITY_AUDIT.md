# Audit sécurité — Authentification & session StockFlow vNext

> Date : 2026-06-23  
> Scope : `src/features/auth`, `src/services/authStorage.ts`, `src/services/edgeFunctions.ts`, `supabase/functions/*` (auth, platform), `supabase/config.toml`, `supabase/migrations`.  
> Statut : Architecture solide, mais trois décisions de configuration/déploiement bloquent une mise en production confiance : wildcard redirect, tokens en stockage navigateur et politique de mot de passe faible.

---

## 1. Résumé exécutif

StockFlow vNext repose sur **Supabase Auth** comme IdP. Les fonctions Edge critiques sont protégées par vérification serveur du JWT (`supabase.auth.getUser()`), le service role n'est jamais envoyé au navigateur, et les flux sensibles (PIN reset, challenge platform-admin) ont été durcis dans les tâches précédentes.

Les risques restants sont principalement **des choix de configuration et d'UX** :

- La liste de redirections Supabase contient un **wildcard `stockflow-*.vercel.app`**, qui permet un vol de token par open redirect.
- Les tokens de session résident dans **`sessionStorage`**, donc vulnérables à un XSS.
- La politique de mot de passe est limitée à **8 caractères** et `secure_password_change = false`.
- Le front-end ne transmet pas le token JWT lors d'une demande de réinitialisation PIN, ce qui rend l'endpoint protégé inutilisable.
- Le rate-limiting et le CORS **fail-open**, ce qui est acceptable pour la disponibilité mais pas pour la résilience anti-abus.

---

## 2. Contrôles positifs

| Domaine                          | Observation                                                                                                   | Preuve                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Vérification JWT                 | Les fonctions Edge appellent `auth.getUser()` avec le bearer token ; aucune confiance dans un décodage local. | `supabase/functions/_shared/auth.ts` `verifyToken()` |
| Stockage service role            | `SUPABASE_SERVICE_ROLE_KEY` n'est lu que côté Edge Functions, jamais dans le navigateur.                      | Tous les `index.ts` des fonctions                    |
| Pas d'énumération magic link     | `send-magic-link` renvoie un message générique même si l'email n'existe pas.                                  | `supabase/functions/send-magic-link/index.ts`        |
| PIN reset protégé                | `request-pin-reset` exige un JWT valide et correspondant à l'email demandé.                                   | `supabase/functions/request-pin-reset/index.ts`      |
| Challenge platform-admin         | PBKDF2-SHA256, sel par ligne, comparaison constante, 5 échecs avant verrouillage, challenge à usage unique.   | `create-platform-challenge`, `_shared/platform.ts`   |
| Journalisation                   | Les événements auth sont écrits dans `activity_logs` / `platform_audit_logs`.                                 | `_shared/audit.ts`                                   |
| RLS des tables sensibles         | `login_attempts`, `magic_link_requests`, `rate_limit_requests`, `activity_logs` ont RLS actif.                | Migrations harden RLS                                |
| Refresh-token rotation           | Activée dans `config.toml` avec intervalle de réutilisation.                                                  | `supabase/config.toml`                               |
| Tokens retirés du `localStorage` | L'application ne persiste plus de token dans `localStorage`.                                                  | `src/features/auth/context/AuthContext.tsx`          |

---

## 3. Configuration Auth & gestion de session

### Ce qui existe

- Supabase Auth avec `jwt_expiry = 3600`, refresh-token rotation activée.
- Tokens stockés dans `sessionStorage` via `authStorage` (`src/services/authStorage.ts`).
- `sudoTarget` déplacé dans `sessionStorage`.

### Risques

| #   | Sévérité     | Problème                                                                                                                                              | Preuve                               | Recommandation                                                                                                                                     |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | **Critique** | Les tokens (`access_token` / `refresh_token`) sont en **`sessionStorage`**. Un XSS permet leur exfiltration.                                          | `src/services/authStorage.ts`        | Migrer vers des cookies `httpOnly`, `Secure`, `SameSite=Lax` (SSR / middleware backend). Jusque-là : CSP stricte et encodage de toute sortie HTML. |
| 3.2 | **Haut**     | `secure_password_change = false` : `updateUser({ password })` ne requiert pas d'authentification récente. Un token volé peut changer le mot de passe. | `supabase/config.toml`               | Passer `secure_password_change = true`. Vérifier que le flux de récupération fonctionne (la session recovery est récente).                         |
| 3.3 | **Haut**     | Politique de mot de passe faible : seule la longueur ≥ 8 est requise.                                                                                 | `supabase/functions/signup/index.ts` | Exiger 12 caractères minimum + vérification de complexité / liste de mots de passe compromis (zxcvbn ou Have I Been Pwned).                        |
| 3.4 | Moyen        | `refresh_token_reuse_interval = 10` élargit la fenêtre de réutilisation d'un refresh token volé.                                                      | `supabase/config.toml`               | Réduire à 0–5 s sauf besoin spécifique de course.                                                                                                  |
| 3.5 | Faible       | `edgeFetch` lit une clé `localStorage` jamais écrite (`stockflow-session`).                                                                           | `src/services/edgeFunctions.ts`      | Supprimer cette lecture ou l'aligner sur `supabase.auth.getSession()`.                                                                             |

### Recommandations

1. Migrer la session vers des cookies httpOnly / backend.
2. Activer `secure_password_change`.
3. Renforcer la politique de mot de passe et l'appliquer aussi à la page `/auth/reset-password`.
4. Réduire le reuse interval des refresh tokens.
5. Nettoyer `edgeFetch` pour qu'il utilise le token Supabase en cours.

---

## 4. Magic links, réinitialisation PIN et vérification email

### Ce qui existe

- `send-magic-link` génère un lien Supabase et l'envoie via Resend.
- `request-pin-reset` force `force_pin_change = true` puis envoie un magic link vers `/auth/reset-pin`.
- Le reset mot de passe front-end appelle `supabase.auth.resetPasswordForEmail()` directement.

### Risques

| #   | Sévérité     | Problème                                                                                                                                                                             | Preuve                                        | Recommandation                                                                                                                                                       |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | **Critique** | Wildcard `https://stockflow-*.vercel.app/**` dans les redirect URLs Supabase. N'importe qui peut créer un projet Vercel correspondant et recevoir le token dans le hash de callback. | `supabase/config.toml`                        | Retirer les wildcards. N'autoriser que les origines exactes de production et de staging. Les previews doivent utiliser un projet séparé ou une allow-list explicite. |
| 4.2 | **Haut**     | `send-magic-link` accepte `redirectTo` client sans validation serveur.                                                                                                               | `supabase/functions/send-magic-link/index.ts` | Valider `redirectTo` côté serveur contre une allow-list exacte avant `generateLink`.                                                                                 |
| 4.3 | **Moyen**    | Le front-end `requestPinReset()` n'envoie pas d'en-tête `Authorization`, donc l'endpoint authentifié renvoie 401.                                                                    | `src/features/auth/context/AuthContext.tsx`   | Ajouter `Authorization: Bearer <session.accessToken>` à l'appel.                                                                                                     |
| 4.4 | Moyen        | Le reset de mot de passe (`resetPasswordForEmail`) est appelé directement depuis le front-end sans rate-limit IP/email custom.                                                       | `AuthContext.resetPassword`                   | Déplacer ce flux derrière une Edge Function rate-limitée et journalisée.                                                                                             |
| 4.5 | Faible       | L'email magic link indique "24 heures" alors que `otp_expiry = 3600` (1 heure).                                                                                                      | Template `send-magic-link` + `config.toml`    | Aligner le wording sur 1 heure ou augmenter `otp_expiry`.                                                                                                            |

### Recommandations

1. Restreindre immédiatement les redirect URLs Supabase.
2. Valider `redirectTo` dans toute fonction générant des liens.
3. Corriger l'appel `requestPinReset()` pour transmettre le JWT.
4. Ajouter du rate-limiting et des logs sur le reset de mot de passe.
5. Aligner l'expirance affichée dans les emails.

---

## 5. Vérification JWT & fonctions Edge publiques/protégées

### Ce qui existe

- `_shared/auth.ts` fournit `verifyToken()` qui appelle `auth.getUser()`.
- `config.toml` liste les fonctions publiques (`verify_jwt = false`) et protégées.
- Le challenge platform-admin est consommé pour `platform-impersonate`.

### Risques

| #   | Sévérité               | Problème                                                                                                                         | Preuve                             | Recommandation                                                                                                                                     |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Faible / documentation | `config.toml` laisse `request-pin-reset` avec `verify_jwt = false` alors que le code exige un token.                             | `supabase/config.toml`             | Passer `verify_jwt = true` pour refléter le comportement réel.                                                                                     |
| 5.2 | Moyen                  | Des actions platform-admin sensibles (`platform-send-password-reset`, `platform-reset-user-pin`) ne consomment pas de challenge. | Fonctions platform correspondantes | Exiger un `X-Platform-Challenge-Id` frais pour toute action d'impact sur un compte.                                                                |
| 5.3 | Moyen                  | Le service role est utilisé largement, contournant RLS.                                                                          | La plupart des fonctions Edge      | Pour les lectures/écritures user-scoped, préférer un client au token utilisateur + RLS. Réserver le service role aux actions où RLS ne suffit pas. |

### Recommandations

1. Synchroniser `verify_jwt` avec le code.
2. Étendre le challenge platform-admin aux resets de mot de passe/PIN.
3. Réduire l'usage du service role aux seuls cas strictement nécessaires.

---

## 6. Politique de mots de passe & AppLock

### Ce qui existe

- Signup impose 8 caractères minimum.
- AppLock est désactivé globalement (`APP_LOCK_ENABLED = false`).
- Si activé, le PIN est dérivé via PBKDF2 100 000 itérations et stocké dans `localStorage`.

### Risques

| #   | Sévérité | Problème                                                                                               | Preuve                                   | Recommandation                                                                                               |
| --- | -------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 6.1 | **Haut** | Politique de mot de passe insuffisante pour un outil financier.                                        | `signup/index.ts`                        | 12 caractères minimum, vérification de complexité, liste de mots de passe compromis.                         |
| 6.2 | Moyen    | AppLock, si réactivé, stocke le hash PIN en `localStorage` sans limite de tentatives et exposé au XSS. | `src/features/auth/utils/appLock.ts`     | Soit retirer AppLock, soit le redéfinir avec stockage chiffré/verrouillé et verrouillage local après échecs. |
| 6.3 | Faible   | `change-pin` ne vérifie pas l'ancien PIN côté serveur (ce n'est qu'un verrouillage local).             | `supabase/functions/change-pin/index.ts` | Documenter clairement que le PIN est un verrou local, pas un second facteur.                                 |

### Recommandations

1. Renforcer la politique de mot de passe.
2. Décider du sort d'AppLock : suppression ou refonte sécurisée.

---

## 7. Rate limiting & anti-bruteforce

### Ce qui existe

- Tables `magic_link_requests` et `rate_limit_requests`.
- Rate limits IP/email dans `send-magic-link`, `request-pin-reset` et `signup`.

### Risques

| #   | Sévérité | Problème                                                                                  | Preuve                                                         | Recommandation                                                                                            |
| --- | -------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 7.1 | Moyen    | Les compteurs de rate-limit **fail-open** en cas d'erreur DB.                             | `_shared/rateLimit.ts`, `send-magic-link`, `request-pin-reset` | Pour les endpoints sensibles, fail-closed (retourner 429/503) et alerter, ou utiliser un circuit-breaker. |
| 7.2 | Moyen    | La table `login_attempts` existe mais n'est jamais alimentée par les échecs de connexion. | Migration `login_attempts`                                     | Écrire les tentatives échouées/réussies depuis le front-end et/ou un webhook Supabase Auth.               |
| 7.3 | Faible   | `signup` retourne `409 Email already registered`, permettant l'énumération d'emails.      | `signup/index.ts`                                              | Retourner un message générique indépendamment de l'existence du compte.                                   |
| 7.4 | Faible   | `api-gateway` n'a pas de rate-limit par clé API, seulement par IP.                        | `supabase/functions/api-gateway/index.ts`                      | Ajouter un rate-limit par clé et révoquer les clés anormales.                                             |

### Recommandations

1. Fail-closed sur les erreurs de rate-limit pour les endpoints critiques.
2. Alimenter `login_attempts`.
3. Rendre `signup` non-énumérable.
4. Ajouter un rate-limit par clé API.

---

## 8. Contournements, vol de token, fixation de session

### Risques

| #   | Sévérité     | Problème                                                                    | Recommandation                                                                                    |
| --- | ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 8.1 | **Critique** | Open redirect via wildcard Vercel → vol de token magic link.                | Retirer le wildcard et valider `redirectTo` serveur.                                              |
| 8.2 | **Haut**     | XSS → exfiltration des tokens depuis `sessionStorage`.                      | Migrer vers cookies httpOnly ; CSP stricte ; encodage des sorties.                                |
| 8.3 | Moyen        | Pas de binding session à appareil / empreinte.                              | Surveiller les nouveaux appareils/impossible travel ; offrir "déconnexion de tous les appareils". |
| 8.4 | Moyen        | Pas de protection anti-bruteforce sur le PIN local si AppLock est réactivé. | Ne pas réactiver AppLock sans verrouillage de tentatives.                                         |

---

## 9. Opérationnel

| #   | Sévérité | Problème                                                                 | Preuve                                                    | Recommandation                                                                         |
| --- | -------- | ------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 9.1 | Faible   | Variables d'environnement incohérentes : `PUBLIC_APP_URL` vs `APP_URL`.  | `platform-send-password-reset`, `platform-reset-user-pin` | Uniformiser sur `PUBLIC_APP_URL` et échouer explicitement si absent.                   |
| 9.2 | Faible   | `health-check` est public et utilise le service role.                    | `supabase/functions/health-check/index.ts`                | Limiter l'accès aux origines de monitoring ou ajouter un secret léger.                 |
| 9.3 | Faible   | `_shared/cors.ts` renvoie `allowed[0]` pour les origines non autorisées. | `supabase/functions/_shared/cors.ts`                      | Ne pas renvoyer d'en-tête `Access-Control-Allow-Origin` pour les origines non listées. |

---

## 10. Plan d'action priorisé

### P0 — Bloquant production

1. Retirer le wildcard `stockflow-*.vercel.app` de `additional_redirect_urls`.
2. Valider `redirectTo` serveur dans `send-magic-link`.
3. Corriger `AuthContext.requestPinReset()` pour envoyer `Authorization: Bearer <token>`.
4. Migrer les tokens vers des cookies `httpOnly` / backend (ou au minimum durcir CSP et encodage).
5. Activer `secure_password_change = true`.

### P1 — Haute priorité

6. Renforcer la politique de mot de passe (12 caractères, complexité, mots de passe compromis).
7. Déplacer le reset de mot de passe derrière une Edge Function rate-limitée.
8. Passer `request-pin-reset` à `verify_jwt = true` dans `config.toml`.
9. Rendre le rate-limit fail-closed sur les erreurs DB pour les endpoints sensibles.
10. Exiger un challenge platform-admin pour `platform-send-password-reset` et `platform-reset-user-pin`.
11. Alimenter `login_attempts`.
12. Décider du sort d'AppLock.

### P2 — Moyenne / faible priorité

13. Uniformiser `PUBLIC_APP_URL` dans toutes les fonctions Edge.
14. Aligner la durée affichée dans les emails magic link.
15. Corriger `cors.ts` pour ne pas renvoyer d'origine par défaut.
16. Rendre `signup` non-énumérable.
17. Ajouter un rate-limit par clé API dans `api-gateway`.
18. Restreindre `health-check`.

---

## 11. Conclusion

L'authentification StockFlow vNext est **architecturalement saine** et a bénéficié d'un durcissement significatif. Les trois correctifs les plus impactants avant production sont :

1. **Retirer le wildcard Vercel** des redirect URLs Supabase.
2. **Valider `redirectTo` serveur** dans toute génération de lien.
3. **Migrer la session hors du `sessionStorage`** vers des cookies httpOnly.

Une fois ces points traités, et avec le renforcement de la politique de mot de passe, la posture auth sera **prête pour une production réglementée** (Afrique francophone, RGPD).

Le code AppLock doit être considéré comme **mort ou comme une fonctionnalité UX**, et non comme un contrôle de sécurité, tant qu'il n'a pas été refondu avec stockage chiffré et anti-bruteforce.
