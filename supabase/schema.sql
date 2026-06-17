-- ============================================================================
-- Calorie Tracker — Supabase schema  (SCHEMA-ISOLATED EDITION)
-- ----------------------------------------------------------------------------
-- This app lives in its OWN Postgres schema (`tracker`) so it can share an
-- existing Supabase project (e.g. "Paperplate") WITHOUT colliding with that
-- project's `public` tables. The free tier allows 2 projects; this avoids
-- needing a 3rd.
--
-- IMPORTANT: this script ONLY creates/owns objects inside the `tracker` schema.
-- It does NOT touch `auth.users`, `public`, or anything Paperplate owns. It is
-- safe to run in a shared project and safe to re-run (idempotent).
--
-- To use a different schema name: find-replace `tracker` below, AND set
-- VITE_DB_SCHEMA in .env.local, AND add that name under Supabase → Settings →
-- API → "Exposed schemas".
--
-- Run: SQL Editor → paste → Run. Then do the one dashboard step in the README
-- (expose the `tracker` schema to the API).
-- ============================================================================

create schema if not exists tracker;

-- pg_trgm powers fuzzy food search (Phase 1). gen_random_uuid() is built into
-- Postgres 15+ (Supabase), so no pgcrypto needed.
create extension if not exists pg_trgm with schema extensions;

-- ---- helpers (namespaced into tracker) -------------------------------------
create or replace function tracker.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ===========================================================================
-- profile : one row per user (created lazily by the app on first login —
-- we deliberately do NOT add an auth.users trigger in a shared project)
-- ===========================================================================
create table if not exists tracker.profile (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  display_name       text,
  sex                text check (sex in ('male','female')),
  birth_year         int,
  height_cm          numeric,
  units              text not null default 'metric' check (units in ('metric','imperial')),
  activity_level     text not null default 'moderate'
                       check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal_direction     text not null default 'maintain' check (goal_direction in ('lose','maintain','gain')),
  goal_weight_kg     numeric,
  goal_rate_kg_per_week numeric not null default 0,
  diet_prefs         text[] not null default '{}',
  exclusions         text[] not null default '{}',
  updated_at         timestamptz not null default now()
);

-- ===========================================================================
-- foods : the single shared, normalized food cache (USDA / OFF / custom)
-- nutrients + servings are JSONB; nutrients are PER 100g (NutrientKey -> value)
-- ===========================================================================
create table if not exists tracker.foods (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  source           text not null check (source in ('usda','off','custom')),
  source_id        text,
  barcode          text,
  name             text not null,
  brand            text,
  is_generic       boolean not null default false,
  nutrients        jsonb not null default '{}',
  servings         jsonb not null default '[]',
  default_serving  int not null default 0,
  favorite         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- For projects created before `favorite` was added (idempotent):
alter table tracker.foods add column if not exists favorite boolean not null default false;
create index if not exists foods_user_idx on tracker.foods(user_id);
create index if not exists foods_source_idx on tracker.foods(user_id, source, source_id);
create index if not exists foods_barcode_idx on tracker.foods(user_id, barcode);
create index if not exists foods_name_trgm_idx on tracker.foods using gin (name extensions.gin_trgm_ops);

-- ===========================================================================
-- recipes : user recipes; per-serving macros computed from foods
-- ===========================================================================
create table if not exists tracker.recipes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  servings         numeric not null default 1,
  steps            text,
  ingredients      jsonb not null default '[]',  -- [{food_id, description, grams, nutrients_per_100g}]
  nutrients_per_serving jsonb not null default '{}',
  tags             text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- For projects created before ingredients was added (idempotent):
alter table tracker.recipes add column if not exists ingredients jsonb not null default '[]';
create index if not exists recipes_user_idx on tracker.recipes(user_id);

create table if not exists tracker.recipe_ingredients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  recipe_id   uuid not null references tracker.recipes(id) on delete cascade,
  food_id     uuid references tracker.foods(id) on delete set null,
  grams       numeric not null,
  note        text
);
create index if not exists recipe_ing_recipe_idx on tracker.recipe_ingredients(recipe_id);

-- ===========================================================================
-- meals : saved meals (group of foods) for one-tap logging
-- ===========================================================================
create table if not exists tracker.meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  items       jsonb not null default '[]',  -- [{food_id, description, grams, nutrients}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- For projects created before items was added (idempotent):
alter table tracker.meals add column if not exists items jsonb not null default '[]';
create table if not exists tracker.meal_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  meal_id     uuid not null references tracker.meals(id) on delete cascade,
  food_id     uuid references tracker.foods(id) on delete set null,
  recipe_id   uuid references tracker.recipes(id) on delete set null,
  grams       numeric not null
);
create index if not exists meal_items_meal_idx on tracker.meal_items(meal_id);

-- ===========================================================================
-- log_entries : THE SPINE. logged + planned items share this table.
-- client_uuid is the device-generated idempotency / outbox key.
-- ===========================================================================
create table if not exists tracker.log_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  client_uuid    uuid not null,
  date           date not null,
  meal_slot      text not null check (meal_slot in ('breakfast','lunch','dinner','snack')),
  source         text not null default 'logged' check (source in ('logged','planned')),
  low_confidence boolean not null default false,
  food_id        uuid references tracker.foods(id) on delete set null,
  recipe_id      uuid references tracker.recipes(id) on delete set null,
  description    text not null default '',
  quantity       numeric not null default 1,
  unit           text not null default 'g',
  grams          numeric not null default 0,
  nutrients      jsonb not null default '{}',
  plan_id        uuid,
  locked         boolean not null default false,
  deleted        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, client_uuid)
);
create index if not exists log_user_date_idx on tracker.log_entries(user_id, date);
create index if not exists log_user_date_slot_idx on tracker.log_entries(user_id, date, meal_slot);

-- ===========================================================================
-- weight_entries : raw + EWMA trend; feeds the adaptive engine
-- ===========================================================================
create table if not exists tracker.weight_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  client_uuid uuid not null,
  date        date not null,
  weight_kg   numeric not null,
  trend_kg    numeric,
  source      text not null default 'manual' check (source in ('manual','healthkit')),
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, client_uuid)
);
create index if not exists weight_user_date_idx on tracker.weight_entries(user_id, date);

-- ===========================================================================
-- targets : dated target rows (manual or adaptive) — keeps history
-- ===========================================================================
create table if not exists tracker.targets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  effective_date date not null,
  energy         numeric not null,
  protein        numeric not null,
  carbs          numeric not null,
  fat            numeric not null,
  micro_limits   jsonb not null default '{}',
  origin         text not null default 'manual' check (origin in ('manual','adaptive')),
  created_at     timestamptz not null default now()
);
create index if not exists targets_user_date_idx on tracker.targets(user_id, effective_date);

-- ===========================================================================
-- tdee_estimates : weekly adaptive-engine output + "why it changed"
-- ===========================================================================
create table if not exists tracker.tdee_estimates (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  week_start       date not null,
  estimate_kcal    numeric not null,
  confidence       numeric not null default 0,
  mean_intake_kcal numeric not null default 0,
  trend_delta_kg   numeric not null default 0,
  note             text not null default '',
  created_at       timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ===========================================================================
-- pantry / plans / water / notes
-- ===========================================================================
create table if not exists tracker.pantry (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  food_id     uuid references tracker.foods(id) on delete cascade,
  grams       numeric not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists tracker.plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists tracker.water_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  client_uuid uuid not null,
  date        date not null,
  ml          numeric not null,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, client_uuid)
);

create table if not exists tracker.day_notes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---- updated_at triggers (all within tracker) ------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profile','foods','recipes','meals','log_entries','weight_entries',
    'plans','water_entries','day_notes'
  ] loop
    execute format('drop trigger if exists set_updated_at on tracker.%I;', t);
    execute format(
      'create trigger set_updated_at before update on tracker.%I
         for each row execute function tracker.set_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
-- Grants — a custom schema (unlike `public`) needs explicit grants so the
-- API roles can reach it. RLS below is what actually protects the rows.
-- ============================================================================
grant usage on schema tracker to anon, authenticated, service_role;
grant all on all tables in schema tracker to anon, authenticated, service_role;
grant all on all sequences in schema tracker to anon, authenticated, service_role;
alter default privileges in schema tracker grant all on tables to anon, authenticated, service_role;
alter default privileges in schema tracker grant all on sequences to anon, authenticated, service_role;

-- ============================================================================
-- Row Level Security : every table is private to its owner (auth.uid())
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profile','foods','recipes','recipe_ingredients','meals','meal_items',
    'log_entries','weight_entries','targets','tdee_estimates','pantry','plans',
    'water_entries','day_notes'
  ] loop
    execute format('alter table tracker.%I enable row level security;', t);
    execute format('drop policy if exists owner_all on tracker.%I;', t);
    execute format(
      'create policy owner_all on tracker.%I
         for all to authenticated
         using (user_id = auth.uid())
         with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- ============================================================================
-- Tell PostgREST to expose the `tracker` schema.
-- PREFERRED: do this in the dashboard (Settings → API → Exposed schemas → add
-- "tracker"), which safely APPENDS to whatever Paperplate already exposes.
--
-- If you'd rather do it in SQL, UNCOMMENT the two lines below — but first check
-- the current value in the dashboard and include every schema already listed,
-- or you'll stop exposing them. The default is 'public, graphql_public'.
-- ----------------------------------------------------------------------------
-- alter role authenticator set pgrst.db_schemas = 'public, graphql_public, tracker';
-- notify pgrst, 'reload config';
