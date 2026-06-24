# Plan : BackOffice SuperAdmin / Moderator pour StockFlow SaaS

## Objectif

Créer un back-office centralisé permettant aux **SuperAdmins** et **Moderators** de la plateforme de :

1. **Monitorer en temps réel** l’activité SaaS (organisations, utilisateurs, mouvements de stock, connexions, alertes, erreurs).
2. **Fournir du support et de l’assistance** aux utilisateurs et organisations (reset PIN, reset password, activer/désactiver un compte, consulter l’activité).
3. **Avoir un mode `sudo`** pour visualiser et agir au nom d’une organisation ou d’un utilisateur spécifique, avec traçabilité complète.

## 1. Modèle de données

### 1.1 Rôles Platform Admin

Ajouter un rôle dans `platform_admins` :

```sql
ALTER TABLE platform_admins ADD COLUMN role TEXT NOT NULL DEFAULT 'moderator'
  CHECK (role IN ('super_admin', 'moderator'));
```

- **super_admin** : accès complet, actions sensibles (suspendre org, changer plan/billing, supprimer données, sudo).
- **moderator** : lecture + actions de support limitées (voir orgs/users, reset PIN, envoyer password reset, débloquer un user), **pas** de suspension de compte, **pas** de modification de plan, **pas** de sudo vers une autre org.

### 1.2 Audit cross-platform

Créer une table dédiée au monitoring/support :

```sql
CREATE TABLE platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),        -- platform admin qui agit
  actor_role TEXT,
  action TEXT NOT NULL,                             -- e.g. 'sudo_enter', 'sudo_exit', 'user_pin_reset', 'org_suspended', 'support_view'
  target_type TEXT,                                 -- 'organization', 'user', 'membership', 'subscription'
  target_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_audit_actor ON platform_audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_platform_audit_target ON platform_audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX idx_platform_audit_action ON platform_audit_logs(action, created_at DESC);
```

### 1.3 Support tickets (Phase 2 optionnelle)

```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  assigned_to UUID REFERENCES platform_admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.4 Tables existantes à enrichir

- `activity_logs` (déjà org-scoped) : ajouter une politique de lecture pour les platform admins.
- `login_attempts` / `magic_link_requests` : ajouter des indexes et une politique de lecture pour platform admins.

## 2. Backend — Edge Functions

Toutes les fonctions sont protégées par `requirePlatformAdmin` (amélioré pour lire le rôle).

### 2.1 Authentification / rôles

- Mettre à jour `supabase/functions/_shared/platform.ts` :
  - `requirePlatformAdmin(req, adminClient, minRole?)` retourne `{ authUserId, email, role }`.
  - Refuser `moderator` pour les actions réservées `super_admin`.

### 2.2 Vue d’ensemble (dashboard temps réel)

Nouvelle fonction `platform-get-overview` :

```json
{
  "organizationsTotal": 0,
  "organizationsActive": 0,
  "usersTotal": 0,
  "usersOnline": 0,
  "movementsToday": 0,
  "subscriptionsByPlan": { "free": 0, "starter": 0, ... },
  "recentAlerts": [...],
  "recentActivity": [...]
}
```

### 2.3 Organisations

- `platform-list-organizations` : ajouter pagination, recherche par nom, filtres par plan/status/suspension.
- `platform-get-organization` : détail d’une org + users + subscription + dernière activité + quotas utilisés.

### 2.4 Utilisateurs

- `platform-list-users` : recherche cross-org par email/nom, filtres par rôle, statut actif, org.
- `platform-get-user` : profil + memberships + dernières connexions + activité.

### 2.5 Support / Sudo

- `platform-impersonate` (`super_admin` uniquement) :
  - Payload : `{ userId }` ou `{ orgId }`.
  - Retourne un token/session temporaire ou marque la session courante en mode sudo.
  - Log dans `platform_audit_logs`.
- `platform-exit-impersonation` : restaure la session platform admin.
- `platform-reset-user-pin` : force `force_pin_change = true`, supprime le hash local (optionnel car le hash est local), envoie un email de reset PIN.
- `platform-send-password-reset` : appelle Supabase `resetPasswordForEmail` avec redirectTo adapté.
- `platform-toggle-user-active` (`super_admin` ou `moderator` selon règles) : active/désactive un membership.

### 2.6 Activité temps réel

- `platform-list-audit-logs` : retourne les `platform_audit_logs` paginés, avec filtres.
- `platform-list-activity-logs` : lit `activity_logs` cross-org pour le support.

## 3. Frontend

### 3.1 Routing

- `/back-office` : dashboard global (remplace `/super-admin` ou cohabite ; on garde `/super-admin` en alias legacy).
- `/back-office/organizations` : liste paginée/filtrée.
- `/back-office/organizations/:orgId` : détail org.
- `/back-office/users` : liste globale des utilisateurs.
- `/back-office/users/:userId` : détail user.
- `/back-office/activity` : feed temps réel.
- `/back-office/support` : tickets de support (Phase 2).

### 3.2 Layout BackOffice

- Barre latérale dédiée avec icônes : Dashboard, Organisations, Utilisateurs, Activité, Support.
- Bannière **SUDO** visible et persistente quand on est en mode impersonation : affiche l’org/user cible + bouton “Quitter le mode support”.

### 3.3 Dashboard temps réel

Cartes clés :
- Total organisations / actives / suspendues
- Total utilisateurs / connexions 24h
- Mouvements aujourd’hui
- Répartition par plan
- Top 5 orgs actives
- Dernières alertes / logs plateforme

Graphiques (recharts) : courbe des inscriptions et des mouvements sur 7/30 jours.

### 3.4 Liste Organisations

Table avec :
- Nom, plan, statut, nombre d’users, dernière activité
- Actions rapides : Voir, Sudo, Suspendre/Réactiver (super_admin), Changer plan (super_admin)

### 3.5 Détail Organisation

Onglets :
- **Vue d’ensemble** : stats, subscription, quotas.
- **Équipe** : liste des users, actions reset PIN / toggle active.
- **Activité** : `activity_logs` de l’org.
- **Paramètres** : bouton “Ouvrir en mode support” (sudo), suspendre, changer plan.

### 3.6 Mode Sudo

- Depuis le BackOffice, clic sur “Voir comme cette organisation”.
- L’app bascule sur `/dashboard` avec une bannière SUDO.
- La session utilise `session.sudoTarget = { type: 'organization', id, name }`.
- Toutes les actions sont loguées dans `platform_audit_logs` avec `action: 'sudo_action'`.
- Le mode sudo est stocké dans `localStorage` pour survivre aux rechargements, mais l’Edge Function d’initialisation le valide côté serveur.

## 4. Temps réel

### 4.1 Supabase Realtime

- Activer realtime sur :
  - `platform_audit_logs`
  - `organizations`
  - `users`
  - `movements`
- Le dashboard s’abonne à `platform_audit_logs` pour rafraîchir automatiquement le feed.
- Fallback polling toutes les 10–30s si Realtime non disponible.

### 4.2 “Users online”

- Détection approximative via `last_login_at` récent (≤ 15 min) ou via un heartbeat optionnel (Phase 2).

## 5. Sécurité & traçabilité

- Toute action effectuée depuis le BackOffice (surtout en sudo) est loguée dans `platform_audit_logs`.
- Les fonctions côté serveur vérifient le rôle (`super_admin` vs `moderator`) avant toute action sensible.
- Le mode sudo est limité dans le temps (expiration de session standard Supabase) et exige une confirmation explicite côté frontend.
- Les policies RLS sur `platform_audit_logs` autorisent uniquement les platform admins.

## 6. Phases de mise en œuvre

### Phase 1 — Fondations (DB + auth)
- Migration : rôle platform admin, `platform_audit_logs`, indexes/RLS.
- Mise à jour `requirePlatformAdmin` pour retourner le rôle.
- Mise à jour `AuthContext` pour stocker `platformAdminRole`.

### Phase 2 — Backend
- Edge Functions overview, org detail, user list/detail, audit logs.
- Edge Functions support : reset PIN, password reset, toggle active.

### Phase 3 — Frontend Dashboard & Lists
- Layout BackOffice.
- Dashboard temps réel.
- Liste et détail organisations/users.

### Phase 4 — Sudo & traçabilité
- `platform-impersonate` / `platform-exit-impersonation`.
- Bannière SUDO.
- Log de toutes les actions sudo.

### Phase 5 — Polish
- Realtime feeds.
- Support tickets (optionnel).
- Rapports CSV/export.

## 7. Choix à valider

1. **Moderator peut-il entrer en mode sudo ?**
   - Recommandation : **non**, sudo réservé aux `super_admin`. Le moderator voit tout en lecture seule et fait des actions support limitées.
2. **L’URL BackOffice remplace-t-elle `/super-admin` ?**
   - Recommandation : `/back-office` devient la nouvelle URL principale, `/super-admin` redirige vers `/back-office` pour ne pas casser les bookmarks.
3. **Support tickets maintenant ou plus tard ?**
   - Recommandation : Phase 2 (après le monitoring et le sudo), car cela ajoute un workflow complet.
4. **Temps réel via Supabase Realtime ou polling ?**
   - Recommandation : implémenter d’abord le polling (simple et robuste), puis ajouter Realtime sur `platform_audit_logs` pour le feed d’activité.
