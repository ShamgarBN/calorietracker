// Nutrient mapping for the Edge Function (Deno runtime).
//
// This mirrors the mapping in src/lib/nutrients.ts. It is intentionally a small,
// dependency-free copy because the Edge Function can't import the Vite app code.
// KEEP IN SYNC with src/lib/nutrients.ts if you add/rename nutrient keys.

export interface NutrientMapEntry {
  key: string
  usda?: string // USDA FoodData Central nutrientNumber
  off?: string // Open Food Facts nutriments base key (we append "_100g")
}

export const NUTRIENT_MAP: NutrientMapEntry[] = [
  { key: 'energy', usda: '208', off: 'energy-kcal' },
  { key: 'protein', usda: '203', off: 'proteins' },
  { key: 'carbs', usda: '205', off: 'carbohydrates' },
  { key: 'fat', usda: '204', off: 'fat' },
  { key: 'fiber', usda: '291', off: 'fiber' },
  { key: 'sugar', usda: '269', off: 'sugars' },
  { key: 'addedSugar', usda: '539', off: 'added-sugars' },
  { key: 'satFat', usda: '606', off: 'saturated-fat' },
  { key: 'monoFat', usda: '645', off: 'monounsaturated-fat' },
  { key: 'polyFat', usda: '646', off: 'polyunsaturated-fat' },
  { key: 'transFat', usda: '605', off: 'trans-fat' },
  { key: 'omega3', usda: '851', off: 'omega-3-fat' },
  { key: 'cholesterol', usda: '601', off: 'cholesterol' },
  { key: 'sodium', usda: '307', off: 'sodium' },
  { key: 'potassium', usda: '306', off: 'potassium' },
  { key: 'calcium', usda: '301', off: 'calcium' },
  { key: 'iron', usda: '303', off: 'iron' },
  { key: 'magnesium', usda: '304', off: 'magnesium' },
  { key: 'zinc', usda: '309', off: 'zinc' },
  { key: 'phosphorus', usda: '305', off: 'phosphorus' },
  { key: 'copper', usda: '312', off: 'copper' },
  { key: 'manganese', usda: '315', off: 'manganese' },
  { key: 'selenium', usda: '317', off: 'selenium' },
  { key: 'vitaminA', usda: '320', off: 'vitamin-a' },
  { key: 'vitaminC', usda: '401', off: 'vitamin-c' },
  { key: 'vitaminD', usda: '328', off: 'vitamin-d' },
  { key: 'vitaminE', usda: '323', off: 'vitamin-e' },
  { key: 'vitaminK', usda: '430', off: 'vitamin-k' },
  { key: 'thiamin', usda: '404', off: 'vitamin-b1' },
  { key: 'riboflavin', usda: '405', off: 'vitamin-b2' },
  { key: 'niacin', usda: '406', off: 'vitamin-pp' },
  { key: 'vitaminB6', usda: '415', off: 'vitamin-b6' },
  { key: 'vitaminB12', usda: '418', off: 'vitamin-b12' },
  { key: 'folate', usda: '435', off: 'vitamin-b9' },
  { key: 'pantothenicAcid', usda: '410', off: 'pantothenic-acid' },
  { key: 'choline', usda: '421', off: 'choline' },
  { key: 'water', usda: '255', off: 'water' },
  { key: 'caffeine', usda: '262', off: 'caffeine' },
  { key: 'alcohol', usda: '221', off: 'alcohol' },
]

export const USDA_TO_KEY: Record<string, string> = Object.fromEntries(
  NUTRIENT_MAP.filter((n) => n.usda).map((n) => [n.usda as string, n.key]),
)

export const OFF_TO_KEY: Record<string, string> = Object.fromEntries(
  NUTRIENT_MAP.filter((n) => n.off).map((n) => [n.off as string, n.key]),
)

export type Nutrients = Record<string, number>
