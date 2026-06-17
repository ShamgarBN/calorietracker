# Macros — Personal Nutrition & Calorie Tracker

A personal, **$0-hosting** nutrition tracker + meal planner that aims to match the best of
MacroFactor / Cronometer / MyFitnessPal / Eat This Much:

- **Adaptive targets** — weekly TDEE recalculated from your real weight-trend + intake, not a static formula.
- **Fast logging** — search, barcode, recents, favorites, saved meals, copy-yesterday, quick-add, (later) AI natural-language.
- **Micronutrient depth** — ~35 nutrients with floors/ceilings and a “what am I short on” report.
- **Fused planner ↔ log** — one shared food database and one set of targets; planning pre-logs, logging updates the plan.
- **Offline-first PWA** — installs to your iPhone home screen and runs in any desktop browser, syncing through Supabase.

> **Status: Phase 3 (adaptive engine & micros).** Everything from logging through goals, plus the
> adaptive TDEE engine (weekly expenditure recalculated from your weight-trend + intake, with a
> "why it changed" explanation and one-tap apply) and a Cronometer-style micronutrient report. The
> meal planner lands in Phase 5 — see [Roadmap](#roadmap).

---

## Architecture at a glance

| Layer | Tech |
|---|---|
| App | React 18 + TypeScript + Vite, Tailwind v4, React Router |
| PWA | `vite-plugin-pwa` (Workbox service worker + manifest) |
| Local store | Dexie (IndexedDB) — **read cache + durable write outbox** |
| Sync | TanStack Query + a custom outbox engine (`src/lib/sync.ts`) |
| Backend | Supabase — Postgres + Auth + auto REST API + (later) Edge Functions + Storage |
| Hosting | GitHub Pages (static) via GitHub Actions |
| Food data | USDA FoodData Central + Open Food Facts (added in Phase 1, via an Edge Function proxy) |

**Durability rule:** Supabase is always the source of truth. IndexedDB is only a cache and an outbox, so
an iOS storage eviction can never lose a log that was already synced. Writes apply locally first (instant,
offline-safe), queue in the outbox, then flush to Supabase on app open / reconnect / every change.

---

## Setup from scratch

### 1. Prerequisites
- Node 20+ and npm
- A free [Supabase](https://supabase.com) account
- A GitHub account (for free hosting)

### 2. Supabase project + schema

You can **create a new project** OR **reuse an existing one** — the free tier caps you at 2 projects,
and this app is built to share. Either way:

1. Pick your project and note its **Project URL** and **anon public key** (Settings → API).
2. Open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql), and **Run**. Everything is
   created inside a dedicated **`tracker`** schema (not `public`), so it won't collide with anything
   already in the project. Idempotent — safe to re-run.
3. **Settings → API → Exposed schemas**: add **`tracker`** to the list (it should read something like
   `public, graphql_public, tracker`) and save. This lets the API serve the app's tables. *(Skipping
   this is the #1 cause of "permission denied"/404 errors.)*
4. **Auth → Providers → Email**: ensure email is enabled (magic links work on the free tier).
5. **Auth → URL Configuration**: add your redirect URLs:
   - `http://localhost:5173` (local dev)
   - `https://<your-username>.github.io/<repo>/` (production)

> **Sharing a project (e.g. with Paperplate).** The two apps share the same project — including the same
> **Auth users**, so it's the *same login*. That's fine for a personal app, and RLS still scopes every
> row to your user. The tracker's tables are namespaced under `tracker.*`, fully separate from the host
> project's `public.*` tables. The schema script never touches `auth.users`, `public`, or the host's
> objects. If you ever want a different schema name, find-replace `tracker` in `supabase/schema.sql`,
> set `VITE_DB_SCHEMA`, and expose that name in step 3.

### 3. Configure env vars locally
```bash
cp .env.example .env.local
# edit .env.local:
#   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
#   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```
These are safe to expose in a static client — RLS, not secrecy, protects your data.

### 4. Run locally
```bash
npm install
npm run dev          # http://localhost:5173
```
Sign in with your email (magic link), then log a weigh-in on the Today tab to confirm sync.

Other scripts:
```bash
npm run build        # typecheck + production build to dist/
npm run preview      # serve the production build locally
npm run icons        # regenerate PNG icons after editing public/icons/favicon.svg
npm run test         # unit tests (Vitest)
```

### 5. Deploy to GitHub Pages (free)
1. Push this repo to GitHub.
2. **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
4. Push to `main` (or run the **Deploy PWA** workflow manually). It builds with the correct base path
   (`/<repo>/`), writes a SPA `404.html` fallback, and publishes to
   `https://<your-username>.github.io/<repo>/`.

### 6. Keep Supabase awake (important)
Free Supabase projects **pause after 7 days of inactivity**. This repo includes
[`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) — a scheduled Action that pings the
REST API every 3 days using the same two secrets. No extra setup needed beyond step 5’s secrets.

> GitHub disables scheduled workflows after 60 days of **no repo activity**. As a backup, create a free
> [UptimeRobot](https://uptimerobot.com) HTTP(s) monitor on
> `https://YOUR-PROJECT.supabase.co/rest/v1/` (header `apikey: YOUR-ANON-KEY`) at a 3-day interval.

### 7. Food search (Edge Function)
Food search proxies USDA FoodData Central + Open Food Facts through a Supabase Edge Function
([`supabase/functions/tracker-food-search`](supabase/functions/tracker-food-search)) so the USDA key
stays server-side, CORS is avoided, and ranking/dedupe happen in one place.

1. Get a free USDA key: **https://fdc.nal.usda.gov/api-key-signup.html** (instant).
2. Store it as the function's secret (Dashboard → **Edge Functions → Secrets**, or via CLI):
   ```bash
   supabase secrets set USDA_API_KEY=YOUR_USDA_KEY --project-ref YOUR_PROJECT_REF
   ```
   > Note: on some setups `supabase secrets set` can't read the keychain token — if it errors with
   > "Access token not provided," set the secret in the **dashboard** instead (it's reliable there).
3. Deploy the function:
   ```bash
   supabase functions deploy tracker-food-search --project-ref YOUR_PROJECT_REF
   ```
Search degrades gracefully: with no USDA key it returns Open Food Facts results only. USDA serves clean
generic/whole foods (ranked first); OFF serves branded/packaged products (and barcodes, Phase 4).

### 8. Install on your iPhone
Open the deployed URL in Safari → Share → **Add to Home Screen**. It launches full-screen like a native
app. (Camera/barcode and Apple Health bridge come in Phases 4 and 3 respectively.)

---

## Project structure
```
src/
  lib/        supabase client, env, Dexie db, sync engine, nutrients model, utils
  data/       data-access modules (offline write path) — e.g. weight.ts
  hooks/      useAuth, …
  components/ AuthGate, Layout, BottomNav, SyncStatus
  pages/      Today, Trends, Plan, Settings
  types/      DB row types mirroring supabase/schema.sql
supabase/     schema.sql (run in the SQL editor)
scripts/      generate-icons.mjs
.github/      deploy + keep-alive workflows
```

## Roadmap
- **Phase 0 ✅** Skeleton, auth, offline sync outbox, deploy + keep-alive.
- **Phase 1 ✅** Food search (USDA + OFF via Edge Function), Today logging, quick-add, recents/favorites, custom foods.
- **Phase 2 ✅** Goals + targets (Mifflin-St Jeor), dashboard rings + remaining budget, trends (streak/adherence/calories), weight chart.
- **Phase 3 ✅** Adaptive TDEE engine + micronutrient report. (Apple Health/Shortcuts bridge deferred — manual weigh-in is the default.)
- **Phase 4** Saved meals, barcode scan, recipes, AI natural-language logging.
- **Phase 5** Meal planner (auto-generate to targets, swaps, locks, pantry-aware grocery list).
- **Phase 6** Full CSV/JSON export + import, accessibility, polish.

Full design rationale lives in the approved plan referenced during development.
