import { db } from '@/lib/db'
import { getPlannedDay } from './planner'

// Pantry is local-only for now (per-device); cross-device sync can come later.
export async function listPantry(): Promise<string[]> {
  return (await db.pantry.toArray()).map((p) => p.name)
}
export async function addPantry(name: string): Promise<void> {
  await db.pantry.put({ name: name.toLowerCase() })
}
export async function removePantry(name: string): Promise<void> {
  await db.pantry.delete(name.toLowerCase())
}

// ---- Aisle categorisation --------------------------------------------------
const AISLES: { aisle: string; words: string[] }[] = [
  { aisle: 'Produce', words: ['apple', 'banana', 'orange', 'strawberr', 'blueberr', 'grape', 'mango', 'pineapple', 'watermelon', 'broccoli', 'spinach', 'carrot', 'pepper', 'tomato', 'cucumber', 'onion', 'green bean', 'asparagus', 'cauliflower', 'zucchini', 'mushroom', 'lettuce', 'avocado', 'potato', 'corn'] },
  { aisle: 'Meat & seafood', words: ['chicken', 'beef', 'steak', 'pork', 'bacon', 'salmon', 'tuna', 'shrimp', 'tilapia', 'turkey'] },
  { aisle: 'Dairy & eggs', words: ['milk', 'yogurt', 'cheese', 'cheddar', 'mozzarella', 'butter', 'egg', 'cottage'] },
  { aisle: 'Grains & bakery', words: ['rice', 'oat', 'pasta', 'spaghetti', 'bread', 'bagel', 'tortilla', 'quinoa', 'couscous'] },
  { aisle: 'Pantry & snacks', words: ['oil', 'honey', 'syrup', 'peanut butter', 'almond', 'walnut', 'cashew', 'chia', 'hummus', 'salsa', 'ketchup', 'chocolate', 'protein', 'tofu', 'tempeh', 'bean', 'chickpea', 'lentil', 'coffee', 'juice'] },
]

function aisleFor(name: string): string {
  const l = name.toLowerCase()
  for (const { aisle, words } of AISLES) if (words.some((w) => l.includes(w))) return aisle
  return 'Other'
}
const AISLE_ORDER = ['Produce', 'Meat & seafood', 'Dairy & eggs', 'Grains & bakery', 'Pantry & snacks', 'Other']

export interface GroceryItem {
  name: string
  grams: number
  have: boolean
}
export interface GroceryAisle {
  aisle: string
  items: GroceryItem[]
}

/** Build a merged, pantry-aware, aisle-sorted grocery list from a day's plan. */
export async function buildGroceryList(date: string): Promise<GroceryAisle[]> {
  const planned = await getPlannedDay(date)
  const pantry = new Set(await listPantry())

  // Merge by ingredient name. Recipe items expand into their ingredients.
  const merged = new Map<string, number>()
  const recipesById = new Map((await db.recipes.toArray()).map((r) => [r.id, r]))

  for (const e of planned) {
    if (e.recipe_id && recipesById.has(e.recipe_id)) {
      const r = recipesById.get(e.recipe_id)!
      // grams here ≈ servings (plan unit); scale ingredient grams by servings.
      const servings = (e.grams || 100) / 100
      for (const ing of r.ingredients) {
        merged.set(ing.description, (merged.get(ing.description) ?? 0) + ing.grams * servings)
      }
    } else {
      merged.set(e.description, (merged.get(e.description) ?? 0) + e.grams)
    }
  }

  const byAisle = new Map<string, GroceryItem[]>()
  for (const [name, grams] of merged) {
    const aisle = aisleFor(name)
    const list = byAisle.get(aisle) ?? []
    list.push({ name, grams: Math.round(grams), have: pantry.has(name.toLowerCase()) })
    byAisle.set(aisle, list)
  }

  return AISLE_ORDER.filter((a) => byAisle.has(a)).map((aisle) => ({
    aisle,
    items: byAisle.get(aisle)!.sort((a, b) => a.name.localeCompare(b.name)),
  }))
}
