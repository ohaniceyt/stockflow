# StockFlow vNext — Go-Live Fast Plan

**Priority: A — Core flow first, admin/super-admin later.**

Goal: get a safe, usable, deployable MVP in production that covers **Products → Stock → Movements → Dashboard**. Everything else stays a stub until the core loop is solid.

---

## Phase 0 — Security & CI hygiene (must finish first)

### 0.1 Rotate the exposed GitHub token

- **Problem:** `git remote -v` shows a personal access token in the origin URL:
  `https://ohaniceyt:<TOKEN_REDACTED>@github.com/ohaniceyt/stockflow.git`
- **Risk:** token is committed to `.git/config`, may leak in backups, logs, or screenshots.
- **Action:**
  1. Rotate the token immediately on GitHub (`Settings → Developer settings → Personal access tokens`).
  2. Remove the token from the origin URL locally:
     ```bash
     git remote set-url origin https://github.com/ohaniceyt/stockflow.git
     ```
  3. Use a credential helper (`gh auth login` or macOS Keychain) for pushes.
  4. Update any CI secrets if needed.

### 0.2 Fix the broken E2E test

- **Problem:** `tests/e2e/login.spec.ts` expects `"Connexion par PIN"` but the login page now shows `"Sélectionnez votre profil puis saisissez votre PIN"`.
- **Action:** update the assertion to match the actual text, or assert on the user-selection prompt instead.

### 0.3 Pre-implementation health checks

- Run `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e` before and after each phase.
- Keep the green CI pipeline green.

---

## Phase 1 — Products (catalog CRUD)

### Why first

Products are the master data for every other feature. Without products, stock and movements have nothing to reference.

### UI

- `/products` page for `super_admin` and `admin`.
- Table view: name, category, unit, threshold, cost/selling price, supplier, active status, actions.
- Add/Edit form in a dialog/drawer (Base UI dialog or sheet).
- Soft-delete via `is_active = false` instead of hard delete (movements keep history).
- Search + filter by category.

### Data layer

- Supabase client reads: `products` table (RLS already restricts to org).
- Admin writes: insert/update products.
- Zod schema for product form validation.
- Cache with TanStack Query (`staleTime: 30s`).
- Optimistic update for toggling `is_active`.

### Supabase changes needed

- No migration needed; `products` table exists.
- Optional: RPC or trigger to enforce `UNIQUE(org_id, name)` with soft-delete nuance.

### Offline

- Sync products into Dexie `products` table on login.
- Read from local DB when offline; queue writes in `pendingOperations` for later sync.

---

## Phase 2 — Stock (view levels + quick adjustment)

### Why second

Once products exist, the next thing users need is to know what is in stock.

### UI

- `/stock` page for all roles.
- Table: product, location, quantity, threshold, status (OK / Low / Out).
- Quick “+ / –” buttons for `admin`/`operator` to record a movement.
- Optional: low-stock badge.

### Data layer

- Reads from `stock_levels` (org-scoped via RLS).
- Writes go through `movements` table; stock levels stay materialized by triggers.
- For this phase we can compute `stock_levels` on the client or via RPC.

### Supabase changes needed

- Add trigger(s) to maintain `stock_levels`:
  - On `IN` movement: increase quantity.
  - On `OUT` movement: decrease quantity (reject if insufficient).
  - On `ADJUSTMENT`/`INVENTORY`: set quantity.
  - On `TRANSFER`: decrease source, increase target.
- Add function `record_movement(...)` to encapsulate the atomic stock update.
- Add trigger to auto-create `stock_levels` row when a product is created (default location).

### Offline

- Sync `stock_levels` and `locations` into Dexie.
- Queue movements when offline; sync on reconnect.

---

## Phase 3 — Movements (IN / OUT / TRANSFER)

### Why third

Movements are the actual work: goods arrive, goods leave, goods move between depots.

### UI

- `/movements` page for all roles; write restricted to `admin`/`operator`.
- Form to create a movement:
  - Type selector: IN, OUT, TRANSFER.
  - Product selector (searchable).
  - Location selector (source + target for transfer).
  - Quantity.
  - Reason / note.
- Table of recent movements with filters (date range, type, product).

### Data layer

- Insert into `movements`; let the database trigger update `stock_levels`.
- Validate quantity > 0 and sufficient stock for OUT/TRANSFER.
- Track `operator_id = auth.uid()`.

### Supabase changes needed

- Reuse the same movement trigger from Phase 2.
- Add RPC `create_movement(...)` that runs as SECURITY DEFINER so it can enforce stock constraints atomically.

### Offline

- Queue movement creation in `pendingOperations`.
- On sync, resolve conflicts: if stock changed since offline, surface a validation error for manual review.

---

## Phase 4 — Dashboard (metrics overview)

### Why last among core

Dashboard needs data from the previous modules to be meaningful.

### UI

- `/` dashboard page.
- Cards: total products, total stock value, low-stock count, movements today.
- Simple bar chart (recharts) of movements by day over last 7 days.
- Recent movements list (top 10).

### Data layer

- Aggregate queries against `products`, `stock_levels`, `movements`.
- Use Supabase RPC for heavy aggregations to avoid fetching large datasets.

### Supabase changes needed

- Add RPC functions:
  - `get_dashboard_summary(org_id)`
  - `get_movements_by_day(org_id, days)`
  - `get_low_stock_products(org_id)`

### Offline

- Dashboard can show stale cached aggregates when offline with a "dernière synchronisation" badge.

---

## Phase 5 — Sync engine (offline-first)

This can be built incrementally alongside Phases 1–4, but finalized after the core flow works online.

### Components

1. **Pull sync** on login and periodically:
   - Fetch org, products, locations, stock_levels, recent movements.
   - Store in Dexie.
2. **Push sync** for pending operations:
   - `pendingOperations` queue (type, payload, retryCount, status).
   - Retry with exponential backoff.
   - Mark failed after N retries; show user a sync conflict UI.
3. **Conflict resolution**:
   - Last-write-wins for products.
   - Stock movements validated server-side; if conflict, flag for manual review.

---

## Design decisions

### UI component strategy

- Use **Base UI** primitives already installed (`@base-ui/react`).
- Avoid adding new heavy UI libraries.
- Keep forms uncontrolled where possible to reduce re-renders; use Zod for validation.

### State management

- **TanStack Query** for server state and caching.
- **Dexie** for offline local cache.
- **Zustand** only if needed for global UI state (e.g., pending sync queue).

### Role enforcement

- Front-end hides UI elements based on `hasRole`.
- Back-end is the real gatekeeper via RLS + RPC `SECURITY DEFINER`.

### Deployment

- Front-end deploys to Vercel via existing GitHub Action.
- Supabase migrations applied via `supabase db push`.
- Edge Functions deployed via `supabase functions deploy`.

---

## Open questions for the user

1. **Locations**: the seed has one default location. Do users need multiple locations for launch, or is single-warehouse OK for MVP?
2. **Product fields**: are cost price / selling price required for launch, or can they be hidden until reporting is built?
3. **Movements**: do you need TRANSFER for launch, or just IN/OUT?
4. **Offline priority**: should the app be usable offline on day one, or is online-only acceptable for the first go-live?

---

## Suggested order of work

1. Phase 0.1 + 0.2 (token + E2E fix).
2. Phase 1 — Products CRUD.
3. Phase 2 — Stock view + triggers.
4. Phase 3 — Movements form + history.
5. Phase 4 — Dashboard.
6. Phase 5 — Offline sync (optional for launch).

Each phase ends with: lint, unit tests, build, and a manual smoke test on the deployed preview.
