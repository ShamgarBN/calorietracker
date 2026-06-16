# Release notes

Personal nutrition tracker + meal planner. Versions track the phased build plan;
each phase is a runnable increment. Newest first.

---

## v0.3.0 — Phase 2: Targets & dashboard

Goals turn the log into a dashboard: see progress vs. targets and trends over time.

**Added**
- **Goal setup** (Settings → Goals & targets): sex, age, height, activity, goal direction + weekly
  rate. Computes daily calorie + macro targets via **Mifflin-St Jeor → TDEE → goal adjustment**
  (7700 kcal/kg), with protein anchored to bodyweight (1.8 g/kg), fat at 25% of calories, carbs filling
  the rest. Live preview as you type; height respects kg/lb (inches vs cm).
- **Today dashboard:** calorie **progress ring** with remaining budget, plus **protein/carbs/fat bars**
  vs target. Over-target turns warm-red. Prompts to set goals when none exist.
- **Trends:** range toggle (14/30/90d), **logging streak**, **average intake**, **adherence %**, a
  **calories-vs-target** bar chart (dashed target line), and the weight raw-vs-trend chart.
- Dated **targets** history (so the adaptive engine can chart changes) and seeded micronutrient
  floors/ceilings. Profile cached locally (Dexie v3) for offline goal reads.

**Notes**
- Targets are the static baseline; Phase 3's adaptive engine recalibrates them from real data.

---

## v0.2.0 — Phase 1: Logging core

The fast-logging foundation: search the combined food database, log at any serving, and
quick-add raw macros — all offline-capable through the sync outbox.

**Added**
- **Food search** via a Supabase Edge Function (`tracker-food-search`) proxying:
  - **USDA FoodData Central** for clean generic/whole foods (Foundation, SR Legacy, FNDDS) with deep
    micronutrient data — ranked first.
  - **Open Food Facts** (Search-a-licious backend) for branded/packaged products — reserved ~40% of
    result slots so branded queries still surface the real product.
  - Normalization to the shared ~39-nutrient model (per 100 g), generic-over-branded ranking, dedupe,
    energy fallback (USDA Atwater factors; OFF kJ→kcal), incomplete-entry filtering, per-source timeout,
    and graceful degradation if one source is down.
- **Today view** rebuilt: per-meal sections (breakfast/lunch/dinner/snack), running calorie + macro
  totals, swipe-free delete, and a compact weigh-in card.
- **Logging flows:** food search with serving/quantity picker, **quick-add by macros**, **custom foods**,
  and **recents + favorites**.
- Foods are cached to the shared `tracker.foods` table (dedup by source) so repeats are instant and
  work across devices.

**Changed**
- `tracker.foods` gains a `favorite` flag + a `(source, source_id)` dedupe index (re-run `schema.sql`).
- Local Dexie store bumped to v2 (foods dedupe index).

**Setup**
- Requires a free USDA API key set as the function secret `USDA_API_KEY`, and the function deployed.
  See README §7.

---

## v0.1.0 — Phase 0: Skeleton & infra

**Added**
- Installable **PWA** (React 18 + Vite + TypeScript + Tailwind v4, `vite-plugin-pwa`) with a calm dark
  UI shell and bottom navigation.
- **Supabase** backend in a dedicated **`tracker` schema** (shareable with an existing project), full
  schema with **Row Level Security** locked to `auth.uid()`, magic-link auth.
- **Offline-first sync:** Dexie as read-cache + durable write **outbox**; flushes on open / online /
  visibility change. Supabase is the source of truth; IndexedDB is disposable.
- The shared **~39-nutrient model**, **kg/lb** unit preference, end-to-end weight-log round-trip.
- **GitHub Pages** deploy workflow + **Supabase keep-alive** workflow, and a full setup README.
