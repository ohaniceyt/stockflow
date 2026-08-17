# Audit — Mode "godmode" / sudo plateforme-admin (Back Office)

> Date : 2026-06-23
> Périmètre : impersonation "Sudo" du back-office, gestion des platform admins, challenge mot de passe, audit logging.
> État : **Fonctionnel en apparence, cassé en pratique** — le sudo est purement client-side et n'active pas le contexte de l'organisation cible.

---

## 1. Ce qu'on appelle "godmode" dans StockFlow vNext

Le "godmode" désigne les capacités super-puissantes du **plateforme-admin** :

- Accès au **Back Office** (`/back-office/*`) : vue d'ensemble, liste des entreprises, utilisateurs, logs d'audit.
- Bouton **"Sudo"** sur la fiche d'une entreprise ou d'un utilisateur : censé permettre à un super-admin de naviguer dans l'app comme s'il était membre de cette entreprise.
- Actions sensibles : suspension d'entreprise, changement de plan, reset PIN/mot de passe, activation/désactivation de membre.

Ces actions sensibles passent par un **challenge mot de passe** (`create-platform-challenge`) pour limiter l'impact d'une session volée.

---

## 2. Architecture actuelle

### 2.1 Back Office

| Composant                       | Rôle                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `BackOfficeLayout.tsx`          | Layout desktop-only, nav entre Vue d'ensemble / Entreprises / Utilisateurs / Audit.          |
| `RequirePlatformAdmin.tsx`      | Redirige vers `/unauthorized` si l'utilisateur n'est pas `platform_admins.is_active = true`. |
| `PlatformChallengeProvider.tsx` | Dialog de saisie de mot de passe plateforme.                                                 |
| `usePlatformChallenge.ts`       | Hook pour obtenir `requestChallenge()` avant une mutation sensible.                          |
| `SudoBanner.tsx`                | Bannière jaune affichée quand `sudoTarget` est défini.                                       |

### 2.2 Edge Functions Back Office

| Fonction                      | Description                                                                                                                      | Contrôle                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `initialize-session`          | Retourne `isPlatformAdmin` + `platformAdminRole` (super_admin / moderator).                                                      | Vérification JWT via `verifyToken`.                                       |
| `create-platform-challenge`   | Vérifie le mot de passe plateforme (PBKDF2-SHA256, lockout après 5 échecs) et génère un challenge à usage unique valable 15 min. | `requirePlatformAdmin(req, adminClient)` (pas de rôle exigé ici).         |
| `platform-impersonate`        | Enregistre l'entrée en sudo.                                                                                                     | `requirePlatformAdmin(..., 'super_admin', true)` — challenge obligatoire. |
| `platform-exit-impersonation` | Enregistre la sortie de sudo.                                                                                                    | `requirePlatformAdmin(..., 'super_admin')` — pas de challenge.            |
| `platform-*` (CRUD)           | Actions back-office diverses.                                                                                                    | Toutes vérifient `requirePlatformAdmin` + challenge quand sensible.       |

### 2.3 Stockage du sudo

- `SUDO_TARGET_KEY = 'stockflow-sudo-target'` dans `sessionStorage`.
- `enterSudo()` appelle `platform-impersonate`, puis stocke `sudoTarget` et met à jour le React state.
- `exitSudo()` appelle `platform-exit-impersonation`, supprime `sessionStorage`, met le state à `null`.

---

## 3. Contrôles positifs

| #   | Contrôle                                                                                       | Preuve                                                                                               |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Seuls les `super_admin` peuvent déclencher le sudo.                                            | `platform-impersonate` exige `minRole = 'super_admin'` + challenge.                                  |
| 2   | Challenge mot de passe robuste : PBKDF2, sel aléatoire, comparaison constante, lockout 30 min. | `create-platform-challenge/index.ts`                                                                 |
| 3   | Toutes les actions sensibles back-office passent par le challenge.                             | `usePlatformChallenge` + `challengeHeaders()`                                                        |
| 4   | Audit logging systématique des entrées/sorties sudo.                                           | `platform_audit_logs.action IN ('sudo_enter', 'sudo_exit', 'challenge_created', 'challenge_failed')` |
| 5   | Impossible d'entrer en sudo dans une entreprise suspendue.                                     | `platform-impersonate` vérifie `targetOrg.is_suspended`.                                             |
| 6   | La sortie de sudo nettoie bien le state client.                                                | `sessionStorage.removeItem(SUDO_TARGET_KEY)` + `persistSession({ sudoTarget: null })`                |

---

## 4. Problèmes critiques

### 4.1 Le sudo ne change pas le contexte organisationnel

**Sévérité : Critique — UX trompeuse + risque opérationnel**

Quand un super-admin clique "Sudo" puis est redirigé vers `/dashboard` :

- `enterSudo()` ne met **pas à jour** `users.active_org_id`.
- `enterSudo()` ne fait **pas** `switchMembership()`.
- Le JWT utilisé est toujours celui du platform admin.
- Toutes les requêtes Supabase/Edge Functions continuent d'opérer dans l'organisation originale du platform admin (ou dans aucune organisation s'il n'en a pas).

**Conséquence :** la bannière "Sudo actif : Acme Corp" laisse penser qu'on agit au nom de Acme Corp, mais le dashboard affiche et modifie les données d'une **autre** entreprise. C'est un risque d'action involontaire sur la mauvaise organisation.

**Preuves :**

```ts
// src/features/auth/context/AuthContext.tsx
const enterSudo = useCallback(
  async (target: SudoTarget) => {
    // ... appel platform-impersonate ...
    persistSession({ ...session, sudoTarget }) // ← seul le state React change
  },
  [session, persistSession]
)
```

```ts
// BackOfficeOrganizationsPage.tsx
const handleSudo = async (org: BackOfficeOrganization) => {
  await enterSudo({ type: 'organization', id: org.id, name: org.name })
  void navigate('/dashboard') // ← navigation vers le dashboard classique
}
```

### 4.2 Le sudo est purement client-side

**Sévérité : Critique — sécurité + isolation**

- Aucun Edge Function ne lit d'en-tête "sudo context" pour appliquer un autre `org_id`.
- Les policies RLS continuent de s'appuyer sur `auth.uid()` et `current_membership()` du platform admin.
- Un XSS peut injecter/modifier `sessionStorage['stockflow-sudo-target']` et afficher une fausse bannière de sudo.

### 4.3 Platform admin peut ne pas avoir d'organisation active

**Sévérité : Haut — cas limite**

Si le compte platform admin n'a pas de membership actif, `initialize-session` retourne `needsOrganization: true`. Le dashboard est alors inaccessible. Le bouton Sudo redirige quand même vers `/dashboard`, ce qui déclenche `RequireAuth` → redirection vers `/onboarding`. L'admin se retrouve coincé dans le flux d'onboarding.

### 4.4 Sortie de sudo sans challenge

**Sévérité : Faible**

`platform-exit-impersonation` n'exige pas de challenge. Ce n'est pas critique car sortir du sudo ne fait que logger, mais cela crée un vecteur de log forging si la session est volée (un attaquant peut générer des `sudo_exit` artificiels).

### 4.5 Session sudo persiste dans `sessionStorage`

**Sévérité : Moyen**

Le target de sudo est stocké en `sessionStorage` (XSS-vulnérable). En cas de XSS, un attaquant peut :

- forger l'affichage de la bannière ;
- piéger l'admin pour qu'il effectue des actions en croyant agir pour une org cible.

---

## 5. Cas de test qui échouent

| #   | Scénario                                                        | Résultat attendu                                | Résultat actuel                                                    |
| --- | --------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Super-admin clique "Sudo" sur l'org A, arrive sur `/dashboard`. | Dashboard affiche les données de l'org A.       | Dashboard affiche les données de l'org propre au super-admin.      |
| 2   | Super-admin crée un mouvement de stock en sudo sur l'org A.     | Le mouvement est enregistré pour l'org A.       | Le mouvement est enregistré pour l'org du super-admin (ou échoue). |
| 3   | Super-admin sans org active clique "Sudo".                      | Redirection contrôlée ou message explicite.     | Redirection vers `/onboarding`.                                    |
| 4   | Sortie de sudo puis retour au back-office.                      | Bannière disparaît et logs reflètent la sortie. | OK côté client ; OK logs côté serveur.                             |

---

## 6. Recommandations

### Option A — Faire un vrai "act as" (recommandé)

Implémenter une impersonation réserve-côté-serveur :

1. Créer une table `platform_admin_impersonation_sessions` (ou champ temporaire) liant `auth_user_id` (admin), `target_org_id`, `target_user_id`, `expires_at`, `challenge_id`.
2. `platform-impersonate` crée cette session et retourne un **token d'impersonation** séparé (ou un claim JWT personnalisé signé).  
   Alternative : Supabase ne permet pas de forger des JWT custom sans clé service, mais on peut créer un token opaque stocké côté serveur.
3. Modifier `initialize-session` (ou créer `resume-impersonation`) pour accepter ce token et retourner `membership` + `organization` de l'**org cible** (avec le rôle du `targetUserId` s'il est fourni).
4. Les Edge Functions sensibles au contexte org doivent lire ce token pour déterminer l'org effective et vérifier qu'il est valide/non expiré.
5. Les RLS doivent tenir compte de l'impersonation. La manière la plus propre : une fonction `current_effective_org_id()` qui, si un admin est en impersonation, retourne l'org cible. Toutes les policies utilisant `current_membership()` doivent être revisitées.
6. `exitSudo()` invalide la session d'impersonation côté serveur.

**Coût : élevé.** Nécessite de revoir toutes les requêtes org-scoped.

### Option B — Restreindre le sudo à une lecture "preview" back-office

Au lieu de rediriger vers l'app principale, rester dans le Back Office et afficher une **vue en lecture seule** des données de l'org cible via les endpoints back-office déjà existants (`platform-get-organization`, etc.).

- Avantage : pas besoin de changer le contexte applicatif.
- Inconvénient : le super-admin ne peut pas "agir comme l'utilisateur".

### Option C — Supprimer le bouton Sudo de l'app principale

Le désactiver temporairement tant que l'Option A n'est pas implémentée.  
Cela évite le risque opérationnel d'actions sur la mauvaise organisation.

### Option D — Mapping temporaire via `switchMembership`

Créer automatiquement une membership temporaire `reader` ou `admin` pour le platform admin dans l'org cible, puis appeler `switchMembership`.

- Problème : pollue la table `organization_memberships` ; nécessite de nettoyer après la sortie ; ne résout pas le cas "targetUserId".

---

## 7. Décision recommandée

| Priorité | Action                                                                                                                            | État          | Justification                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------- |
| **P0**   | Désactiver le bouton Sudo dans l'app principale ou afficher un avertissement explicite "Prévisualisation en cours de réparation". | ✅ Appliqué   | Élimine immédiatement le risque d'action sur la mauvaise org. |
| **P1**   | Implémenter l'Option A (impersonation serveur) si le besoin métier est réel.                                                      | ⏳ En attente | Seule solution saine et complète.                             |
| **P2**   | Passer `platform-exit-impersonation` en mode "challenge requis" (optionnel).                                                      | ⏳ En attente | Renforce la traçabilité.                                      |
| **P2**   | Nettoyer automatiquement les `sessionStorage` sudo orphelins au démarrage.                                                        | ✅ Appliqué   | Limite la durée de vie d'un spoof XSS.                        |

---

## 8. Actions entreprises suite à l'audit

1. **Boutons Sudo remplacés par un indicateur "Sudo indisponible"**
   - `src/features/back-office/pages/BackOfficeOrganizationsPage.tsx`
   - `src/features/back-office/pages/BackOfficeOrganizationDetailPage.tsx`
   - `src/features/back-office/pages/BackOfficeUserDetailPage.tsx`
   - Le tooltip explique que l'impersonation est désactivée en attendant une implémentation serveur sécurisée.

2. **Nettoyage des `sessionStorage` sudo orphelins au boot**
   - `src/features/auth/context/AuthContext.tsx` : suppression de `SUDO_TARGET_KEY` au montage du provider, empêchant une bannière de sudo fantôme de réapparaître après un refresh.

3. **Imports inutilisés retirés**
   - `enterSudo` et `handleSudo` supprimés des trois pages back-office concernées.

---

## 9. Mise à jour du mot de passe platform admin

Le message récent `Platform admin password not configured. Set a password before using challenges.` indique que la ligne `platform_admins.password_hash` est `NULL` pour le compte concerné.

**Cause racine :** `supabase/migrations/00000000000014_platform_admin_rpc.sql` insère l'admin platform à partir du compte démo sans `password_hash`. La migration ultérieure `20260629010000_platform_admin_password.sql` ajoute la colonne mais ne la remplit pas.

**Correction opérationnelle :** exécuter `scripts/seed-admin.mjs` avec un `PLATFORM_ADMIN_PASSWORD` fort (≥ 20 caractères). Le script met à jour le mot de passe Auth et écrit le hash PBKDF2 correspondant dans `platform_admins.password_hash`.

---

## 10. Conclusion

Le "godmode" est **visuellement présent mais fonctionnellement brisé**. Le challenge mot de passe est solide, l'audit logging est en place, mais le sudo ne bascule pas le contexte organisationnel. Un super-admin qui clique "Sudo" risque de croire qu'il agit pour une entreprise cliente alors qu'il modifie ses propres données (ou l'inverse).

**Verdict immédiat :** désactiver ou clairement marquer le bouton Sudo comme non fonctionnel jusqu'à l'implémentation d'une impersonation serveur complète.
