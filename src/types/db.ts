// TypeScript shapes mirroring the Supabase schema (supabase/schema.sql).
// Kept hand-written (rather than generated) so the app has a stable, documented
// contract even before the database exists. Regenerate-by-hand if you change SQL.

import type { Nutrients, NutrientKey, TargetKind } from '@/lib/nutrients'

export type UUID = string
/** ISO date, no time, e.g. "2026-06-16". The app's day key. */
export type ISODate = string
export type Timestamptz = string

export type FoodSource = 'usda' | 'off' | 'custom'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
/** A row in `log_entries` is either really eaten (`logged`) or pre-logged by the planner (`planned`). */
export type EntrySource = 'logged' | 'planned'
export type Sex = 'male' | 'female'
export type GoalDirection = 'lose' | 'maintain' | 'gain'

/** A named portion of a food, with its weight in grams. */
export interface Serving {
  label: string // "1 cup", "1 medium", "100 g"
  grams: number
}

export interface Profile {
  user_id: UUID
  display_name: string | null
  sex: Sex | null
  birth_year: number | null
  height_cm: number | null
  units: 'metric' | 'imperial'
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  goal_direction: GoalDirection
  goal_weight_kg: number | null
  goal_rate_kg_per_week: number // negative = loss
  diet_prefs: string[] // e.g. ["vegetarian"]
  exclusions: string[] // disliked / excluded foods or tags
  updated_at: Timestamptz
}

export interface Food {
  id: UUID
  user_id: UUID
  source: FoodSource
  source_id: string | null // USDA fdcId / OFF barcode / null for custom
  barcode: string | null
  name: string
  brand: string | null
  is_generic: boolean // USDA Foundation/SR -> true; branded -> false
  /** Nutrients PER 100g. */
  nutrients: Nutrients
  servings: Serving[]
  default_serving: number // index into servings
  created_at: Timestamptz
  updated_at: Timestamptz
}

export interface LogEntry {
  id: UUID
  user_id: UUID
  client_uuid: UUID // generated on-device; the idempotency / outbox key
  date: ISODate
  meal_slot: MealSlot
  source: EntrySource
  low_confidence: boolean // "eating out" / rough estimate flag
  food_id: UUID | null
  recipe_id: UUID | null
  description: string // denormalized label for fast rendering / quick-add
  quantity: number
  unit: string // "g" or a serving label
  grams: number // resolved grams (quantity * serving grams)
  /** Computed absolute nutrients for this entry (already scaled). */
  nutrients: Nutrients
  plan_id: UUID | null
  locked: boolean // planner lock
  created_at: Timestamptz
  updated_at: Timestamptz
  deleted: boolean // soft delete so sync can propagate removals
}

export interface WeightEntry {
  id: UUID
  user_id: UUID
  client_uuid: UUID
  date: ISODate
  weight_kg: number
  trend_kg: number | null // EWMA, computed on read/insert
  source: 'manual' | 'healthkit'
  created_at: Timestamptz
  updated_at: Timestamptz
  deleted: boolean
}

export interface TargetRow {
  id: UUID
  user_id: UUID
  effective_date: ISODate
  energy: number
  protein: number
  carbs: number
  fat: number
  /** Per-nutrient floors/ceilings keyed by NutrientKey. */
  micro_limits: Partial<Record<NutrientKey, { kind: TargetKind; value: number }>>
  origin: 'manual' | 'adaptive'
  created_at: Timestamptz
}

export interface TdeeEstimate {
  id: UUID
  user_id: UUID
  week_start: ISODate
  estimate_kcal: number
  confidence: number // 0..1
  mean_intake_kcal: number
  trend_delta_kg: number
  note: string // human-readable "why it changed"
  created_at: Timestamptz
}

/** All locally-queued mutations live here until synced. The durability guarantee. */
export interface OutboxItem {
  id?: number // Dexie auto-increment
  table: string
  op: 'upsert' | 'delete'
  payload: Record<string, unknown>
  client_uuid: string
  queued_at: number
  tries: number
  last_error?: string
}
