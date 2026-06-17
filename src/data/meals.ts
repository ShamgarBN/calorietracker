import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { currentUserId } from '@/lib/supabase'
import { uuid, todayISO } from '@/lib/util'
import { logEntryFromItem } from './log'
import type { Meal, MealItem, LogEntry, MealSlot } from '@/types/db'

function nowISO() {
  return new Date().toISOString()
}

async function persistMeal(meal: Meal): Promise<void> {
  await queueMutation({
    table: 'meals',
    op: 'upsert',
    payload: meal as unknown as Record<string, unknown>,
    client_uuid: meal.id,
    localApply: async () => {
      await db.meals.put(meal)
    },
  })
}

/** Bundle a set of (already logged) entries into a reusable one-tap meal. */
export async function createMealFromEntries(name: string, entries: LogEntry[]): Promise<Meal> {
  const userId = await currentUserId()
  const items: MealItem[] = entries.map((e) => ({
    food_id: e.food_id,
    recipe_id: e.recipe_id,
    description: e.description,
    grams: e.grams,
    unit: e.unit,
    nutrients: e.nutrients,
  }))
  const meal: Meal = {
    id: uuid(),
    user_id: userId,
    name: name.trim() || 'Saved meal',
    items,
    created_at: nowISO(),
    updated_at: nowISO(),
  }
  await persistMeal(meal)
  return meal
}

export async function getMeals(): Promise<Meal[]> {
  return db.meals.orderBy('name').toArray()
}

export async function deleteMeal(id: string): Promise<void> {
  // Hard delete is fine here (meals are user-curated, low-churn).
  await db.meals.delete(id)
  await queueMutation({
    table: 'meals',
    op: 'delete',
    payload: { id },
    client_uuid: id,
    localApply: async () => {},
  })
}

/** Log every item in a saved meal into a day/slot in one tap. */
export async function logMeal(meal: Meal, mealSlot: MealSlot, date = todayISO()): Promise<void> {
  for (const item of meal.items) {
    await logEntryFromItem(item, mealSlot, date)
  }
}
