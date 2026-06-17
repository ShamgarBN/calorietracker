import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { currentUserId } from '@/lib/supabase'
import { uuid, todayISO } from '@/lib/util'
import { scaleNutrients, sumNutrients, type Nutrients } from '@/lib/nutrients'
import { logEntryFromItem } from './log'
import type { Recipe, RecipeIngredient, MealSlot } from '@/types/db'

function nowISO() {
  return new Date().toISOString()
}

/** Per-serving nutrients = sum(each ingredient scaled by its grams) / servings. */
export function recipePerServing(ingredients: RecipeIngredient[], servings: number): Nutrients {
  const total = sumNutrients(ingredients.map((i) => scaleNutrients(i.nutrients_per_100g, i.grams)))
  const out: Nutrients = {}
  const s = servings > 0 ? servings : 1
  for (const [k, v] of Object.entries(total)) out[k as keyof Nutrients] = (v as number) / s
  return out
}

async function persistRecipe(recipe: Recipe): Promise<void> {
  await queueMutation({
    table: 'recipes',
    op: 'upsert',
    payload: recipe as unknown as Record<string, unknown>,
    client_uuid: recipe.id,
    localApply: async () => {
      await db.recipes.put(recipe)
    },
  })
}

export async function saveRecipe(input: {
  id?: string
  name: string
  servings: number
  steps?: string
  ingredients: RecipeIngredient[]
}): Promise<Recipe> {
  const userId = await currentUserId()
  const existing = input.id ? await db.recipes.get(input.id) : undefined
  const recipe: Recipe = {
    id: input.id ?? uuid(),
    user_id: userId,
    name: input.name.trim() || 'Recipe',
    servings: input.servings > 0 ? input.servings : 1,
    steps: input.steps?.trim() || null,
    ingredients: input.ingredients,
    nutrients_per_serving: recipePerServing(input.ingredients, input.servings),
    tags: existing?.tags ?? [],
    created_at: existing?.created_at ?? nowISO(),
    updated_at: nowISO(),
  }
  await persistRecipe(recipe)
  return recipe
}

export async function getRecipes(): Promise<Recipe[]> {
  return db.recipes.orderBy('name').toArray()
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipes.delete(id)
  await queueMutation({
    table: 'recipes',
    op: 'delete',
    payload: { id },
    client_uuid: id,
    localApply: async () => {},
  })
}

/** Log N servings of a recipe into a day/slot. */
export async function logRecipe(recipe: Recipe, servings: number, mealSlot: MealSlot, date = todayISO()): Promise<void> {
  const n = servings > 0 ? servings : 1
  const nutrients: Nutrients = {}
  for (const [k, v] of Object.entries(recipe.nutrients_per_serving)) {
    nutrients[k as keyof Nutrients] = (v as number) * n
  }
  await logEntryFromItem(
    {
      food_id: null,
      recipe_id: recipe.id,
      description: `${recipe.name}${n !== 1 ? ` ×${n}` : ''}`,
      grams: 0,
      unit: n === 1 ? 'serving' : 'servings',
      nutrients,
    },
    mealSlot,
    date,
  )
}
