# StockFlow Design System

Ce dossier centralise les composants UI réutilisables et la fondation visuelle de StockFlow. L’objectif est de remplacer progressivement les utilitaires CSS custom par un langage visuel unique basé sur shadcn/ui + Tailwind CSS v4.

## Composants

- `PageHeader` — en-tête normalisé pour chaque page (titre, description, actions, retour).
- `PageSection` — section thématique avec un cadre card aéré.
- `DataCard` — carte de KPI unifiée (dashboard, stock, analytics).
- `EmptyState` — état vide illustré pour listes et pages.
- `StatusBadge` — badge de statut coloré (OK, alerte, danger, info, neutre).

## Règles d’usage

1. Préférer `PageHeader` + `PageSection` sur chaque page plutôt que des `space-y-4` bruts.
2. Utiliser `DataCard` pour tous les indicateurs chiffrés.
3. Ne plus créer de classes utilitaires custom ; étendre les composants shadcn si besoin.
4. Garder les zones tactiles à min 44 px et le contraste suffisant.

## Map de migration des utilitaires dépréciés

| Utilitaire déprécié                  | Remplacement                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `.btn-o`                             | `<Button variant="outline" />`                                                                       |
| `.btn-p`                             | `<Button />` (default)                                                                               |
| `.btn-sm`                            | `<Button size="sm" />`                                                                               |
| `.btn-ic`                            | `<Button size="icon" />`                                                                             |
| `.bd-g`                              | `<StatusBadge variant="success" />`                                                                  |
| `.bd-y`                              | `<StatusBadge variant="warning" />`                                                                  |
| `.bd-r`                              | `<StatusBadge variant="danger" />`                                                                   |
| `.card`                              | `rounded-xl border bg-card p-5 shadow-sm` ou `<PageSection>`                                         |
| `.sc`, `.sk`                         | `<DataCard>`                                                                                         |
| `.sg`                                | `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4` + `<DataCard>`                                |
| `.card-t`                            | `<PageSection title="...">` ou `text-sm font-semibold uppercase tracking-wide text-muted-foreground` |
| `.ca`, `.cr`, `.cy`                  | Couleurs Tailwind `bg-*-100 text-*-700` via `StatusBadge`                                            |
| `.dash-empty`                        | `<EmptyState>`                                                                                       |
| `.ov` / `.ov-panel`                  | Composants shadcn `Dialog`                                                                           |
| `--surface`, `--surface-2`           | `bg-card`, `bg-muted`                                                                                |
| `--text`, `--text-faint`, `--text-h` | `text-foreground`, `text-muted-foreground`, `text-card-foreground`                                   |
| `--r-md`                             | `rounded-xl` / `--radius-lg`                                                                         |
| `--shadow-xs`                        | `shadow-sm`                                                                                          |
