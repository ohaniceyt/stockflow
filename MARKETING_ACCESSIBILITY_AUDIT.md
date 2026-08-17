# Audit accessibilité marketing — StockFlow vNext

> Date : 2026-06-23
> Portée : pages et composants marketing (landing, feature pages, pricing, légales)

---

## Résumé

L’accessibilité des pages marketing a été renforcée pour couvrir la navigation au clavier, la restitution aux lecteurs d’écran et la structure sémantique. Aucune régression visuelle ; les changements passent `npm run lint` et `npm run build`.

---

## Changements appliqués

### 1. Skip link global

- **Composant** : `src/features/marketing/components/SkipLink.tsx`
- **Intégration** : ajouté sur toutes les pages marketing :
  - `LandingPage.tsx`
  - `PricingPage.tsx`
  - `FeaturePage.tsx` (utilisé par les 4 feature pages)
  - `LegalPage.tsx` (utilisé par `/privacy`, `/terms`, `/cookies`, `/data-residency`)
- **Comportement** : lien « Aller au contenu principal » visible uniquement au focus, pointe vers `main id="main-content"`.

### 2. Header marketing

**Fichier** : `src/features/marketing/components/MarketingHeader.tsx`

- Menu mobile contrôlé par `useState`.
- Bouton hamburger avec `aria-expanded`, `aria-controls="mobile-menu"`, `aria-label` dynamique.
- Menu mobile en `role="dialog" aria-modal="true"` avec `aria-label="Menu mobile"`.
- Navigation desktop `aria-label="Navigation principale"`.
- Logo avec `aria-label="StockFlow, retour à l'accueil"`.
- Focus visible (`focus-visible:ring`) sur tous les liens via `MarketingLink`.

### 3. Focus visible sur les liens marketing

**Fichier** : `src/features/marketing/components/MarketingLink.tsx`

- Ajout d’un ring `focus-visible` par défaut sur tous les liens marketing (`MarketingLink` et donc `Link`).
- Cela propage l’indicateur de focus à `MarketingHeader`, `MarketingFooter`, `TopBanner`, etc.

### 4. Section tarifs

**Fichier** : `src/features/marketing/components/PricingSection.tsx`

- Toggle mensuel/annuel en `role="tab"` avec `aria-selected` et `aria-controls="pricing-cards"`.
- Boutons de devise en `role="tab"` avec `aria-selected` et `aria-label="Devise …"`.
- Conteneur de cartes avec `id="pricing-cards" role="tabpanel" aria-label="Grille des tarifs"`.

### 5. Dialog démo Hero

**Fichiers** :

- `src/features/marketing/components/HeroDemoDialog.tsx`
- `src/features/marketing/components/HeroSection.tsx`

- Transformation du `<dialog>` natif en composant React contrôlé (`open` / `onClose`).
- `aria-modal="true"`, `aria-labelledby="demo-title"`.
- Gestion de la touche `Esc` via l’événement `cancel` du `<dialog>`.
- Bouton de fermeture avec `aria-label="Fermer la vidéo de démo"`.

### 6. Preuves sociales

**Fichier** : `src/features/marketing/components/SocialProof.tsx`

- Étoiles décoratives en `aria-hidden="true"` avec un texte alternatif `aria-label="Note 5 étoiles sur 5"`.
- Logos clients avec `aria-label={logo.name}`.
- Témoignages structurés en `<figure>`, citation en `<blockquote>`, source en `<figcaption>`.

### 7. Consentement cookies

**Fichier** : `src/features/marketing/components/CookieConsent.tsx`

- Ajout de `aria-modal="true"`.
- Focus initial automatique sur le bouton « Tout accepter » quand la bannière apparaît.
- Focus visible sur le lien « En savoir plus ».

---

## Validation

```bash
npm run lint   # ✅ 0 erreur
npm run build  # ✅ build + prerender OK
```

---

## Reste à faire (non bloquant)

- Ajouter des tests E2E a11y avec Axe/playwright sur les pages marketing.
- Vérifier le contraste des couleurs avec un outil automatique (ex. axe DevTools).
- Implémenter le focus trap manuel pour la bannière cookie si le composant devient plus complexe.
