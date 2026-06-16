import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { currentUserId } from '@/lib/supabase'
import { uuid } from '@/lib/util'
import type { Food, Serving } from '@/types/db'
import type { FoodResult } from '@/types/food'
import type { Nutrients } from '@/lib/nutrients'

function nowISO() {
  return new Date().toISOString()
}

/** Persist (or reuse) a searched food as a Food row in the shared cache. */
export async function saveFoodFromResult(r: FoodResult): Promise<Food> {
  const existing = await db.foods
    .where('[source+source_id]')
    .equals([r.source, r.source_id])
    .first()
  if (existing) return existing

  const userId = await currentUserId()
  const food: Food = {
    id: uuid(),
    user_id: userId,
    source: r.source,
    source_id: r.source_id,
    barcode: r.barcode,
    name: r.name,
    brand: r.brand,
    is_generic: r.is_generic,
    nutrients: r.nutrients,
    servings: r.servings.length ? r.servings : [{ label: '100 g', grams: 100 }],
    default_serving: r.default_serving,
    favorite: false,
    created_at: nowISO(),
    updated_at: nowISO(),
  }
  await persistFood(food)
  return food
}

/** Create a user-defined custom food (nutrients given per 100g). */
export async function createCustomFood(input: {
  name: string
  brand?: string | null
  nutrients: Nutrients
  servings?: Serving[]
}): Promise<Food> {
  const userId = await currentUserId()
  const food: Food = {
    id: uuid(),
    user_id: userId,
    source: 'custom',
    source_id: null,
    barcode: null,
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    is_generic: false,
    nutrients: input.nutrients,
    servings: input.servings?.length ? input.servings : [{ label: '100 g', grams: 100 }],
    default_serving: 0,
    favorite: false,
    created_at: nowISO(),
    updated_at: nowISO(),
  }
  await persistFood(food)
  return food
}

export async function toggleFavorite(foodId: string): Promise<void> {
  const food = await db.foods.get(foodId)
  if (!food) return
  const updated: Food = { ...food, favorite: !food.favorite, updated_at: nowISO() }
  await persistFood(updated)
}

async function persistFood(food: Food): Promise<void> {
  await queueMutation({
    table: 'foods',
    op: 'upsert',
    payload: food as unknown as Record<string, unknown>,
    client_uuid: food.id,
    localApply: async () => {
      await db.foods.put(food)
    },
  })
}

/** Distinct foods you've logged recently (most recent first). */
export async function getRecentFoods(limit = 12): Promise<Food[]> {
  const entries = await db.log_entries.orderBy('updated_at').reverse().toArray()
  const ids: string[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    if (e.deleted || !e.food_id || seen.has(e.food_id)) continue
    seen.add(e.food_id)
    ids.push(e.food_id)
    if (ids.length >= limit) break
  }
  const foods = await db.foods.bulkGet(ids)
  return foods.filter((f): f is Food => Boolean(f))
}

export async function getFavoriteFoods(): Promise<Food[]> {
  return db.foods.filter((f) => f.favorite).toArray()
}
