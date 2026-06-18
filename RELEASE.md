# Release notes

Personal nutrition tracker + meal planner. Versions track the phased build plan;
each phase is a runnable increment. Newest first.

---

## v1.2.0 — Edit entries + combine foods

- **Edit a logged entry**: tap any logged food on Home to change its serving/amount or meal (food
  entries reuse the serving picker; quick-adds open a macro editor) — no more delete-and-redo.
- **Combine foods into one library item**: after logging a few foods, the "Save these foods" sheet now
  offers **"As one food"** — e.g. coffee + half & half + sugar → a single **"My Coffee"** in your
  library that logs as one line and is searchable/favoritable. (The "As a meal" option, which logs each
  item separately, is still there.)

---

## v1.1.0 — US Imperial units + day history

- **US Imperial throughout** (now the default): pounds for body weight, **ounces** for food amounts,
  **fluid ounces** for water (8 / 16 oz quick-adds), feet/inches for height. Switch to Metric anytime in
  Settings → Units. (Macros stay in grams — that's how US nutrition labels read; calories are unit-neutral.)
- **Home** (renamed from "Today") now has a **day navigator** — step back up to 7 days to view or
  back-fill a previous day's log, water, and notes; tap the date to jump back to today.

---

## v1.0.4 — Fix: food logs / weights / water never synced

**Critical sync fix.** `log_entries`, `weight_entries`, and `water_entries` are uniquely keyed by
`(user_id, client_uuid)`, but the sync layer used `client_uuid` alone as the upsert conflict target —
so every one of those upserts failed with Postgres 42P10 and the rows lived only in each device's
local cache (never reaching Supabase, never reaching other devices). Conflict targets now match the
real composite constraints. Combined with v1.0.3's non-blocking flush, queued logs/weights now sync.

---

## v1.0.3 — Sync robustness

- A failing queued write no longer blocks the whole outbox — items are skipped and retried
  individually, so one bad row can't stall everything behind it.
- Added a 30s periodic sync retry while the app is open (catches a stuck queue + pulls cross-device
  changes), on top of sync-on-change / open / foreground.
- The sync chip now shows "N stuck" and, when tapped, reveals the actual error — so a sync problem is
  visible instead of silently piling up.

---

## v1.0.2 — Email + password sign-in

- Added email + password sign-in (default on the login screen; magic link kept as a fallback) and a
  "Set password" option in Settings, removing the dependence on rate-limited emailed magic links.

---

## v1.0.1 — Custom serving units

- The serving picker now always offers **gram (g)** and **ounce (oz)** alongside a food's named
  servings, so you can log any amount (e.g. 4 g of sugar in coffee) instead of being limited to "100 g".

---

## v1.0.0 — Phase 6: Data ownership, QoL & ship

Feature-complete v1, deployed to GitHub Pages.

**Added**
- **Full data export/import**: round-trippable JSON backup of everything + a CSV of your food log;
  import a JSON backup back through the sync outbox (Settings → Your data).
- **Water tracking** (+250/+500 ml, undo, daily goal) and **per-day notes** (autosave) on Today.
- **Code-split bundle**: initial load 1041 kB → 645 kB (185 kB gzip); Recharts and the barcode scanner
  load on demand.
- **Live deploy** to GitHub Pages with the keep-alive Action; installable to the iOS home screen.

**v1 Definition of Done — all met:** log by search/barcode/quick-add; goals + daily targets; adaptive
engine recalibrates from ≥1 week of data; dashboard + weight-trend; micronutrient report; export +
re-import; generate a plan to targets, swap, pre-log; pantry-aware aisle-sorted grocery list;
installable + synced across devices; offline-capable; full setup README.

---

## v0.6.0 — Phase 5: Meal planner

The headline feature — and it's one system with the tracker, not a bolt-on.

**Added**
- **Auto-generate a day to your targets**: a greedy + repair algorithm allocates the calorie target
  across meals, picks protein/carb/veg per slot from the curated library + your foods/recipes, and
  nudges portions to hit protein (≥92%) and stay within ±8% of calories. (4 unit tests.)
- **Lock / Swap / Regenerate**: lock meals you like; regenerate or swap a single meal leaves locks
  untouched. Deterministic so swaps are reproducible.
- **Pre-log to today**: a plan writes `planned` entries that show on Today (distinct, dashed) — tap
  **"Ate it"** to flip a planned item to logged. Totals still count only what you've actually eaten.
- **Pantry-aware grocery list**: merges duplicate ingredients across meals (recipes expand into their
  ingredients), sorts by aisle, and subtracts what you check off into your pantry.

**Notes**
- Respects your dietary exclusions (from goal setup). Pantry is per-device for now.

---

## v0.5.0 — Phase 4: Fast logging

Make logging effortless — the difference between a tracker you keep up and one you abandon.

**Added**
- **Saved meals**: bundle a meal slot into a one-tap reusable meal; log it from the add sheet.
- **Copy yesterday**: pull a whole day's food forward; per-slot copy too.
- **Recipes**: builder with inline ingredient search + editable grams, live per-serving macros computed
  from the food DB, steps; log any number of servings (scales).
- **Curated food library**: 80 clean staples (chicken, rice, eggs, oats, oils, common produce/dairy)
  from USDA, surfaced instantly and ranked first — works offline. This fixes the "can't find grilled
  chicken" gap. Regenerate with `npm run curated`.
- **Barcode scanning**: camera (ZXing) → Open Food Facts product, with manual-entry fallback and
  graceful permission handling (iOS PWA-safe).
- **AI natural-language logging**: type "2 eggs and a cup of oats" → Anthropic (Haiku) parses it →
  each item matched to the food DB → you review/adjust grams → log. Confirm-before-log; a cost guard
  requires a real signed-in user so the paid endpoint can't be abused.

**Setup**
- AI logging needs the `tracker-parse-food` function deployed + an `ANTHROPIC_API_KEY` secret (README §7).
- Re-run `schema.sql` (adds `meals.items` + `recipes.ingredients`).

---

## v0.4.0 — Phase 3: Adaptive engine & micronutrients

The tracker's headline: targets that recalibrate from your real data, plus micronutrient depth.

**Added**
- **Adaptive TDEE engine** (Trends → Adaptive expenditure): estimates your true daily expenditure from
  energy balance — `meanIntake − (Δtrend-weight × 7700) / days` over a trailing window, using the
  smoothed (EWMA) trend weight to strip out water noise. Confidence-weighted by how complete the window
  is, blended with the prior so a noisy week can't swing targets, with a Mifflin cold-start fallback.
  Shows the estimate, a confidence bar, a plain-English "why it changed", and a one-tap **Apply to my
  targets** (which keeps your goal rate).
- **Micronutrient report** (Cronometer-style): 7-day average intake vs floors/ceilings, shortfalls and
  overages surfaced first.
- 6 unit tests covering the estimator, targets math, and micro flagging.

**Notes**
- The engine is intentionally data-hungry — it shows "keep logging" until ~2 weeks of logs + a few
  weigh-ins exist, then activates.
- The Apple Health / Shortcuts bridge was **deferred** (manual weigh-in remains the way to log weight).

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
