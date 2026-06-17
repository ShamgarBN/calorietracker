// Builds a curated "common foods" library from USDA FoodData Central into
// src/data/curatedFoods.ts. These are clean, well-named staples that the app
// surfaces instantly (offline, ranked first) so logging basics is one tap.
//
// Run: USDA_API_KEY=xxx node scripts/build-curated-foods.mjs
// (Re-run anytime to refresh; the output file is committed.)

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const KEY = process.env.USDA_API_KEY
if (!KEY) {
  console.error('Set USDA_API_KEY env var.')
  process.exit(1)
}

const USDA_TO_KEY = {
  208: 'energy', 203: 'protein', 205: 'carbs', 204: 'fat', 291: 'fiber', 269: 'sugar',
  539: 'addedSugar', 606: 'satFat', 645: 'monoFat', 646: 'polyFat', 605: 'transFat',
  851: 'omega3', 601: 'cholesterol', 307: 'sodium', 306: 'potassium', 301: 'calcium',
  303: 'iron', 304: 'magnesium', 309: 'zinc', 305: 'phosphorus', 312: 'copper',
  315: 'manganese', 317: 'selenium', 320: 'vitaminA', 401: 'vitaminC', 328: 'vitaminD',
  323: 'vitaminE', 430: 'vitaminK', 404: 'thiamin', 405: 'riboflavin', 406: 'niacin',
  415: 'vitaminB6', 418: 'vitaminB12', 435: 'folate', 410: 'pantothenicAcid',
  421: 'choline', 255: 'water', 262: 'caffeine', 221: 'alcohol',
}

// Clean display name + USDA search query + optional common serving (grams).
const ITEMS = [
  // Proteins
  ['Chicken breast, grilled', 'chicken breast grilled skinless', 140],
  ['Chicken breast, raw', 'chicken breast boneless skinless raw', 140],
  ['Chicken thigh, cooked', 'chicken thigh meat only cooked', 100],
  ['Ground beef, 90/10, cooked', 'ground beef 90 lean cooked', 113],
  ['Ground beef, 80/20, cooked', 'ground beef 80 lean cooked', 113],
  ['Steak, sirloin, cooked', 'beef top sirloin cooked', 113],
  ['Pork chop, cooked', 'pork loin chop cooked', 113],
  ['Bacon, cooked', 'bacon cooked', 16],
  ['Salmon, cooked', 'salmon atlantic cooked', 113],
  ['Tuna, canned in water', 'tuna light canned water drained', 85],
  ['Shrimp, cooked', 'shrimp cooked', 85],
  ['Tilapia, cooked', 'tilapia cooked', 113],
  ['Egg, whole, large', 'egg whole raw fresh', 50],
  ['Egg white', 'egg white raw fresh', 33],
  ['Tofu, firm', 'tofu firm prepared', 100],
  ['Tempeh', 'tempeh', 100],
  ['Black beans, cooked', 'black beans mature cooked boiled', 172],
  ['Chickpeas, cooked', 'chickpeas mature cooked boiled', 164],
  ['Lentils, cooked', 'lentils mature cooked boiled', 198],
  ['Greek yogurt, plain, nonfat', 'yogurt greek plain nonfat', 170],
  ['Cottage cheese, lowfat', 'cottage cheese lowfat 2%', 113],
  ['Whey protein powder', 'whey protein powder', 31],
  // Grains / carbs
  ['White rice, cooked', 'rice white long-grain cooked', 158],
  ['Brown rice, cooked', 'rice brown long-grain cooked', 195],
  ['Quinoa, cooked', 'quinoa cooked', 185],
  ['Oats, rolled, dry', 'oats rolled dry', 40],
  ['Pasta, cooked', 'spaghetti cooked enriched', 140],
  ['Bread, whole wheat', 'bread whole-wheat commercially prepared', 28],
  ['Bread, white', 'bread white commercially prepared', 28],
  ['Bagel, plain', 'bagel plain enriched', 99],
  ['Tortilla, flour', 'tortillas flour wheat', 49],
  ['Potato, baked', 'potato baked flesh and skin', 173],
  ['Sweet potato, baked', 'sweet potato baked in skin', 130],
  ['Couscous, cooked', 'couscous cooked', 157],
  // Vegetables
  ['Broccoli, cooked', 'broccoli cooked boiled drained', 156],
  ['Spinach, raw', 'spinach raw', 30],
  ['Carrots, raw', 'carrots raw', 61],
  ['Bell pepper, raw', 'peppers sweet red raw', 119],
  ['Tomato, raw', 'tomatoes red ripe raw', 123],
  ['Cucumber, raw', 'cucumber with peel raw', 104],
  ['Onion, raw', 'onions raw', 110],
  ['Green beans, cooked', 'green beans cooked boiled drained', 125],
  ['Asparagus, cooked', 'asparagus cooked boiled drained', 90],
  ['Cauliflower, cooked', 'cauliflower cooked boiled drained', 124],
  ['Zucchini, cooked', 'squash zucchini cooked', 180],
  ['Mushrooms, raw', 'mushrooms white raw', 70],
  ['Lettuce, romaine', 'lettuce romaine raw', 47],
  ['Avocado', 'avocados raw all commercial', 50],
  ['Corn, cooked', 'corn sweet yellow cooked', 164],
  // Fruits
  ['Apple', 'apples raw with skin', 182],
  ['Banana', 'bananas raw', 118],
  ['Orange', 'oranges raw all commercial', 131],
  ['Strawberries', 'strawberries raw', 152],
  ['Blueberries', 'blueberries raw', 148],
  ['Grapes', 'grapes red or green raw', 151],
  ['Mango', 'mango raw', 165],
  ['Pineapple', 'pineapple raw', 165],
  ['Watermelon', 'watermelon raw', 152],
  // Dairy / alternatives
  ['Milk, 2%', 'milk reduced fat 2%', 244],
  ['Milk, whole', 'milk whole 3.25%', 244],
  ['Milk, skim', 'milk nonfat fat free skim', 245],
  ['Almond milk, unsweetened', 'almond milk unsweetened', 240],
  ['Cheddar cheese', 'cheese cheddar', 28],
  ['Mozzarella cheese', 'cheese mozzarella part skim', 28],
  ['Butter', 'butter salted', 14],
  // Fats / nuts
  ['Olive oil', 'oil olive', 14],
  ['Peanut butter', 'peanut butter smooth', 32],
  ['Almonds', 'almonds raw', 28],
  ['Walnuts', 'walnuts english', 28],
  ['Peanuts', 'peanuts all types raw', 28],
  ['Cashews', 'cashew nuts raw', 28],
  ['Chia seeds', 'seeds chia dried', 28],
  // Other staples
  ['Honey', 'honey', 21],
  ['Maple syrup', 'syrup maple', 20],
  ['Hummus', 'hummus commercial', 30],
  ['Salsa', 'salsa ready-to-serve', 36],
  ['Ketchup', 'ketchup', 17],
  ['Coffee, brewed', 'coffee brewed espresso', 240],
  ['Orange juice', 'orange juice raw', 248],
  ['Dark chocolate', 'chocolate dark 70-85% cacao', 28],
]

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const QUALIFIERS = new Set(['cooked', 'raw', 'grilled', 'roasted', 'boiled', 'baked', 'dry', 'canned'])

function extractNutrients(food) {
  const nutrients = {}
  for (const fn of food.foodNutrients ?? []) {
    const k = USDA_TO_KEY[fn.nutrientNumber]
    if (k && typeof fn.value === 'number') nutrients[k] = Math.round(fn.value * 100) / 100
  }
  if (nutrients.energy == null) {
    for (const num of [957, 958]) {
      const fn = (food.foodNutrients ?? []).find((x) => Number(x.nutrientNumber) === num && typeof x.value === 'number')
      if (fn) { nutrients.energy = Math.round(fn.value); break }
    }
  }
  return nutrients
}

// Score a description against the query: reward matched words, and strongly enforce
// qualifier words (so "rice ... cooked" never returns a raw entry).
function score(desc, qTokens) {
  const d = desc.toLowerCase()
  let s = 0
  for (const t of qTokens) {
    if (d.includes(t)) s += QUALIFIERS.has(t) ? 5 : 1
    else if (QUALIFIERS.has(t)) s -= 6
  }
  return s
}

async function fetchBest(query) {
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, pageSize: 12, dataType: ['Foundation', 'SR Legacy'] }),
  })
  if (!res.ok) throw new Error(`USDA ${res.status} for "${query}"`)
  const data = await res.json()
  const qTokens = query.toLowerCase().split(/\s+/)
  // Only candidates that actually have a calorie value (Foundation often omits it).
  const candidates = (data.foods ?? [])
    .map((f) => ({ f, nutrients: extractNutrients(f) }))
    .filter((c) => c.nutrients.energy != null)
  if (!candidates.length) return null
  candidates.sort((a, b) => {
    const sa = score(a.f.description ?? '', qTokens)
    const sb = score(b.f.description ?? '', qTokens)
    if (sa !== sb) return sb - sa // higher score first
    return (a.f.description?.length ?? 999) - (b.f.description?.length ?? 999) // then cleaner/shorter
  })
  const best = candidates[0]
  return { fdcId: best.f.fdcId, nutrients: best.nutrients, picked: best.f.description }
}

const out = []
for (const [name, query, servingG] of ITEMS) {
  try {
    const r = await fetchBest(query)
    if (!r) { console.warn('skip (no data):', name); continue }
    const servings = [{ label: '100 g', grams: 100 }]
    if (servingG) servings.unshift({ label: `1 serving (${servingG} g)`, grams: servingG })
    out.push({
      source_id: `curated:${slug(name)}`,
      name,
      nutrients: r.nutrients,
      servings,
      default_serving: 0,
    })
    console.log(`ok: ${name.padEnd(34)} ${String(Math.round(r.nutrients.energy)).padStart(4)} kcal  <- ${r.picked}`)
  } catch (e) {
    console.warn('error:', name, e.message)
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const header = `// AUTO-GENERATED by scripts/build-curated-foods.mjs — do not edit by hand.
// Curated common-foods library (USDA FoodData Central), surfaced instantly + ranked first.
import type { FoodResult } from '@/types/food'

export const CURATED_FOODS: FoodResult[] = ${JSON.stringify(
    out.map((f) => ({ source: 'usda', source_id: f.source_id, barcode: null, name: f.name, brand: null, is_generic: true, nutrients: f.nutrients, servings: f.servings, default_serving: f.default_serving })),
    null,
    0,
  )}
`
await writeFile(join(root, 'src/data/curatedFoods.ts'), header)
console.log(`\nWrote ${out.length} curated foods to src/data/curatedFoods.ts`)
