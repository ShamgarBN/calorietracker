# Release notes

Personal nutrition tracker + meal planner. Versions track the phased build plan;
each phase is a runnable increment. Newest first.

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
