import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { currentUserId } from '@/lib/supabase'
import { uuid, todayISO } from '@/lib/util'
import { CURATED_FOODS } from './curatedFoods'
import { getCurrentTarget } from './targets'
import { getProfile } from './profile'
import { generateDay, planTotals, type PlanCandidate, type PlannedItem, type FoodRole, type SlotWeight } from '@/lib/planner'
import type { LogEntry, MealSlot } from '@/types/db'
import type { Nutrients } from '@/lib/nutrients'

// Default meal structure (shares of the day's calories).
const DEFAULT_SLOTS: SlotWeight[] = [
  { slot: 'breakfast', weight: 0.25 },
  { slot: 'lunch', weight: 0.35 },
  { slot: 'dinner', weight: 0.3 },
  { slot: 'snack', weight: 0.1 },
]

// ---- role + slot heuristics ------------------------------------------------
const KW: { role: FoodRole; words: string[] }[] = [
  { role: 'protein', words: ['chicken', 'beef', 'steak', 'pork', 'bacon', 'salmon', 'tuna', 'shrimp', 'tilapia', 'egg', 'tofu', 'tempeh', 'bean', 'chickpea', 'lentil', 'yogurt', 'cottage', 'whey', 'protein'] },
  { role: 'carb', words: ['rice', 'quinoa', 'oat', 'pasta', 'spaghetti', 'bread', 'bagel', 'tortilla', 'potato', 'couscous', 'corn', 'honey', 'syrup'] },
  { role: 'fat', words: ['oil', 'butter', 'peanut butter', 'almond', 'walnut', 'cashew', 'chia', 'avocado'] },
  { role: 'snack', words: ['apple', 'banana', 'orange', 'strawberr', 'blueberr', 'grape', 'mango', 'pineapple', 'watermelon', 'chocolate', 'hummus', 'salsa', 'ketchup'] },
  { role: 'veg', words: ['broccoli', 'spinach', 'carrot', 'pepper', 'tomato', 'cucumber', 'onion', 'green bean', 'asparagus', 'cauliflower', 'zucchini', 'mushroom', 'lettuce'] },
]

const BREAKFAST_WORDS = ['oat', 'egg', 'yogurt', 'banana', 'milk', 'bread', 'bagel', 'peanut butter', 'berr', 'coffee', 'cottage', 'honey', 'apple', 'orange', 'almond', 'chia']

function roleFor(name: string, n: Nutrients): FoodRole {
  const lower = name.toLowerCase()
  for (const { role, words } of KW) if (words.some((w) => lower.includes(w))) return role
  // Fallback by macro dominance.
  const p = (n.protein ?? 0) * 4, c = (n.carbs ?? 0) * 4, f = (n.fat ?? 0) * 9
  if (p >= c && p >= f) return 'protein'
  if (f > c) return 'fat'
  return 'carb'
}

function slotsFor(name: string, role: FoodRole): MealSlot[] {
  const lower = name.toLowerCase()
  const bfast = BREAKFAST_WORDS.some((w) => lower.includes(w))
  if (role === 'snack') return bfast ? ['breakfast', 'snack'] : ['snack']
  if (role === 'veg') return ['lunch', 'dinner']
  if (role === 'fat') return bfast ? ['breakfast', 'lunch', 'dinner', 'snack'] : ['lunch', 'dinner']
  // protein / carb
  return bfast ? ['breakfast', 'lunch', 'dinner'] : ['lunch', 'dinner']
}

const GRAM_RANGE: Record<FoodRole, [number, number]> = {
  protein: [40, 300],
  carb: [30, 320],
  veg: [50, 300],
  fat: [5, 45],
  snack: [20, 180],
}

/** Build the planning candidate pool: curated staples + user custom foods + recipes. */
export async function buildPool(exclusions: string[] = []): Promise<{ candidates: PlanCandidate[]; meta: Map<string, { foodId?: string; recipeId?: string }> }> {
  const meta = new Map<string, { foodId?: string; recipeId?: string }>()
  const excluded = (name: string) => exclusions.some((x) => x && name.toLowerCase().includes(x.toLowerCase()))
  const candidates: PlanCandidate[] = []

  for (const f of CURATED_FOODS) {
    if (excluded(f.name)) continue
    const role = roleFor(f.name, f.nutrients)
    candidates.push({ id: f.source_id, name: f.name, role, slots: slotsFor(f.name, role), per100g: f.nutrients, minGrams: GRAM_RANGE[role][0], maxGrams: GRAM_RANGE[role][1] })
  }

  // User custom/favorite foods (per-100g nutrients already).
  const userFoods = await db.foods.filter((f) => f.source === 'custom' || f.favorite).toArray()
  for (const f of userFoods) {
    if (excluded(f.name)) continue
    const role = roleFor(f.name, f.nutrients)
    candidates.push({ id: f.id, name: f.name, role, slots: slotsFor(f.name, role), per100g: f.nutrients, minGrams: GRAM_RANGE[role][0], maxGrams: GRAM_RANGE[role][1] })
    meta.set(f.id, { foodId: f.id })
  }

  // Recipes (treat per-serving as per-100g unit; one "serving" ≈ 100 plan-grams).
  const recipes = await db.recipes.toArray()
  for (const r of recipes) {
    if (excluded(r.name)) continue
    const role = roleFor(r.name, r.nutrients_per_serving)
    const id = `recipe:${r.id}`
    candidates.push({ id, name: r.name, role, slots: ['lunch', 'dinner'], per100g: r.nutrients_per_serving, minGrams: 50, maxGrams: 250 })
    meta.set(id, { recipeId: r.id })
  }

  return { candidates, meta }
}

export interface GeneratedPlan {
  date: string
  items: PlannedItem[]
  totals: ReturnType<typeof planTotals>
  target: { energy: number; protein: number; carbs: number; fat: number } | null
}

/** Generate a plan for a day to the current targets. Locked items are preserved. */
export async function generatePlan(date = todayISO(), opts: { locked?: PlannedItem[]; seed?: number } = {}): Promise<GeneratedPlan> {
  const [target, profile] = await Promise.all([getCurrentTarget(date), getProfile()])
  if (!target) return { date, items: [], totals: { energy: 0, protein: 0, carbs: 0, fat: 0 }, target: null }
  const { candidates } = await buildPool(profile?.exclusions ?? [])
  const items = generateDay({
    targets: { energy: target.energy, protein: target.protein, carbs: target.carbs, fat: target.fat },
    slots: DEFAULT_SLOTS,
    candidates,
    locked: opts.locked,
    seed: opts.seed ?? 0,
  })
  return { date, items, totals: planTotals(items), target: { energy: target.energy, protein: target.protein, carbs: target.carbs, fat: target.fat } }
}

// ---- persistence: planned items are log_entries (source='planned') ---------

function nowISO() {
  return new Date().toISOString()
}

/** Replace the planned entries for a day with a freshly generated plan. */
export async function savePlannedDay(date: string, items: PlannedItem[]): Promise<void> {
  const userId = await currentUserId()
  const planId = uuid()
  const { meta } = await buildPool()

  // Soft-delete existing PLANNED entries for the date (leave logged ones alone).
  const existing = await db.log_entries.where('date').equals(date).filter((e) => e.source === 'planned' && !e.deleted).toArray()
  for (const e of existing) {
    const del: LogEntry = { ...e, deleted: true, updated_at: nowISO() }
    await persistEntry(del)
  }

  for (const it of items) {
    const m = meta.get(it.candidateId) ?? {}
    const entry: LogEntry = {
      id: uuid(),
      user_id: userId,
      client_uuid: uuid(),
      date,
      meal_slot: it.slot,
      source: 'planned',
      low_confidence: false,
      food_id: m.foodId ?? null,
      recipe_id: m.recipeId ?? null,
      description: it.name,
      quantity: 1,
      unit: 'g',
      grams: it.grams,
      nutrients: it.nutrients,
      plan_id: planId,
      locked: Boolean(it.locked),
      created_at: nowISO(),
      updated_at: nowISO(),
      deleted: false,
    }
    await persistEntry(entry)
  }
}

/** Flip a planned entry to logged ("I ate this"). */
export async function markPlannedEaten(clientUuid: string): Promise<void> {
  const e = await db.log_entries.get(clientUuid)
  if (!e) return
  await persistEntry({ ...e, source: 'logged', updated_at: nowISO() })
}

export async function getPlannedDay(date: string): Promise<LogEntry[]> {
  const rows = await db.log_entries.where('date').equals(date).toArray()
  return rows.filter((e) => !e.deleted && e.source === 'planned')
}

async function persistEntry(entry: LogEntry): Promise<void> {
  await queueMutation({
    table: 'log_entries',
    op: 'upsert',
    payload: entry as unknown as Record<string, unknown>,
    client_uuid: entry.client_uuid,
    localApply: async () => {
      await db.log_entries.put(entry)
    },
  })
}
