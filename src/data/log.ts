import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { currentUserId } from '@/lib/supabase'
import { uuid, todayISO } from '@/lib/util'
import { scaleNutrients, sumNutrients, type Nutrients } from '@/lib/nutrients'
import type { Food, LogEntry, MealSlot } from '@/types/db'

function nowISO() {
  return new Date().toISOString()
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

/** Log a food at a chosen serving. Nutrients are resolved + denormalized onto the entry. */
export async function logFood(args: {
  food: Food
  grams: number
  mealSlot: MealSlot
  date?: string
  unitLabel?: string
  quantity?: number
}): Promise<void> {
  const userId = await currentUserId()
  const entry: LogEntry = {
    id: uuid(),
    user_id: userId,
    client_uuid: uuid(),
    date: args.date ?? todayISO(),
    meal_slot: args.mealSlot,
    source: 'logged',
    low_confidence: false,
    food_id: args.food.id,
    recipe_id: null,
    description: args.food.brand ? `${args.food.name} · ${args.food.brand}` : args.food.name,
    quantity: args.quantity ?? args.grams,
    unit: args.unitLabel ?? 'g',
    grams: args.grams,
    nutrients: scaleNutrients(args.food.nutrients, args.grams),
    plan_id: null,
    locked: false,
    created_at: nowISO(),
    updated_at: nowISO(),
    deleted: false,
  }
  await persistEntry(entry)
}

/** Quick-add when you just know the macros (no food lookup). */
export async function quickAddMacros(args: {
  description: string
  energy: number
  protein: number
  carbs: number
  fat: number
  mealSlot: MealSlot
  date?: string
  lowConfidence?: boolean
}): Promise<void> {
  const userId = await currentUserId()
  const nutrients: Nutrients = {
    energy: args.energy,
    protein: args.protein,
    carbs: args.carbs,
    fat: args.fat,
  }
  const entry: LogEntry = {
    id: uuid(),
    user_id: userId,
    client_uuid: uuid(),
    date: args.date ?? todayISO(),
    meal_slot: args.mealSlot,
    source: 'logged',
    low_confidence: args.lowConfidence ?? false,
    food_id: null,
    recipe_id: null,
    description: args.description.trim() || 'Quick add',
    quantity: 1,
    unit: 'serving',
    grams: 0,
    nutrients,
    plan_id: null,
    locked: false,
    created_at: nowISO(),
    updated_at: nowISO(),
    deleted: false,
  }
  await persistEntry(entry)
}

export async function deleteEntry(clientUuid: string): Promise<void> {
  const entry = await db.log_entries.get(clientUuid)
  if (!entry) return
  const updated: LogEntry = { ...entry, deleted: true, updated_at: nowISO() }
  await persistEntry(updated)
}

export async function getDayEntries(date: string): Promise<LogEntry[]> {
  const rows = await db.log_entries.where('date').equals(date).toArray()
  return rows.filter((e) => !e.deleted).sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** Sum nutrients for a day (optionally only logged, excluding planned). */
export function dayTotals(entries: LogEntry[], includePlanned = false): Nutrients {
  const use = includePlanned ? entries : entries.filter((e) => e.source === 'logged')
  return sumNutrients(use.map((e) => e.nutrients))
}
