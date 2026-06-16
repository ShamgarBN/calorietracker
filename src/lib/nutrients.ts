// The canonical nutrient model for the whole app.
//
// Every food's nutrition is stored as a `Nutrients` map of these keys, expressed
// PER 100g (the normalization base). USDA + Open Food Facts both get mapped into
// this set. The `usdaNumber` lets the Edge Function translate USDA's nutrient
// numbers; `off` lets it pull from Open Food Facts' nutriments object.
//
// `target` defaults are general adult reference values used to seed the user's
// micronutrient floors/ceilings — the user can override every one of them.

export type NutrientKey =
  | 'energy'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'sugar'
  | 'addedSugar'
  | 'satFat'
  | 'monoFat'
  | 'polyFat'
  | 'transFat'
  | 'omega3'
  | 'cholesterol'
  | 'sodium'
  | 'potassium'
  | 'calcium'
  | 'iron'
  | 'magnesium'
  | 'zinc'
  | 'phosphorus'
  | 'copper'
  | 'manganese'
  | 'selenium'
  | 'vitaminA'
  | 'vitaminC'
  | 'vitaminD'
  | 'vitaminE'
  | 'vitaminK'
  | 'thiamin'
  | 'riboflavin'
  | 'niacin'
  | 'vitaminB6'
  | 'vitaminB12'
  | 'folate'
  | 'pantothenicAcid'
  | 'choline'
  | 'water'
  | 'caffeine'
  | 'alcohol'

export type Nutrients = Partial<Record<NutrientKey, number>>

export type NutrientKind = 'macro' | 'mineral' | 'vitamin' | 'other'
/** How the user usually constrains a nutrient: a daily floor, a daily ceiling, or neither. */
export type TargetKind = 'floor' | 'ceiling' | 'none'

export interface NutrientDef {
  key: NutrientKey
  label: string
  unit: 'kcal' | 'g' | 'mg' | 'µg'
  kind: NutrientKind
  /** USDA FoodData Central nutrient number (string form as in the API). */
  usdaNumber?: string
  /** Key inside Open Food Facts' `nutriments` object (per 100g, `_100g` suffix added by mapper). */
  off?: string
  /** Default daily reference amount used to seed floors/ceilings. */
  target?: number
  targetKind: TargetKind
}

export const NUTRIENTS: NutrientDef[] = [
  // --- Macros ---
  { key: 'energy', label: 'Energy', unit: 'kcal', kind: 'macro', usdaNumber: '208', off: 'energy-kcal', targetKind: 'none' },
  { key: 'protein', label: 'Protein', unit: 'g', kind: 'macro', usdaNumber: '203', off: 'proteins', targetKind: 'floor' },
  { key: 'carbs', label: 'Carbs', unit: 'g', kind: 'macro', usdaNumber: '205', off: 'carbohydrates', targetKind: 'none' },
  { key: 'fat', label: 'Fat', unit: 'g', kind: 'macro', usdaNumber: '204', off: 'fat', targetKind: 'none' },
  { key: 'fiber', label: 'Fiber', unit: 'g', kind: 'macro', usdaNumber: '291', off: 'fiber', target: 30, targetKind: 'floor' },
  { key: 'sugar', label: 'Sugar', unit: 'g', kind: 'macro', usdaNumber: '269', off: 'sugars', targetKind: 'none' },
  { key: 'addedSugar', label: 'Added sugar', unit: 'g', kind: 'macro', usdaNumber: '539', off: 'added-sugars', target: 36, targetKind: 'ceiling' },
  { key: 'satFat', label: 'Saturated fat', unit: 'g', kind: 'macro', usdaNumber: '606', off: 'saturated-fat', target: 22, targetKind: 'ceiling' },
  { key: 'monoFat', label: 'Monounsat. fat', unit: 'g', kind: 'macro', usdaNumber: '645', off: 'monounsaturated-fat', targetKind: 'none' },
  { key: 'polyFat', label: 'Polyunsat. fat', unit: 'g', kind: 'macro', usdaNumber: '646', off: 'polyunsaturated-fat', targetKind: 'none' },
  { key: 'transFat', label: 'Trans fat', unit: 'g', kind: 'macro', usdaNumber: '605', off: 'trans-fat', target: 2, targetKind: 'ceiling' },
  { key: 'omega3', label: 'Omega-3', unit: 'g', kind: 'macro', usdaNumber: '851', off: 'omega-3-fat', target: 1.6, targetKind: 'floor' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', kind: 'other', usdaNumber: '601', off: 'cholesterol', target: 300, targetKind: 'ceiling' },
  // --- Minerals ---
  { key: 'sodium', label: 'Sodium', unit: 'mg', kind: 'mineral', usdaNumber: '307', off: 'sodium', target: 2300, targetKind: 'ceiling' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', kind: 'mineral', usdaNumber: '306', off: 'potassium', target: 3400, targetKind: 'floor' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', kind: 'mineral', usdaNumber: '301', off: 'calcium', target: 1000, targetKind: 'floor' },
  { key: 'iron', label: 'Iron', unit: 'mg', kind: 'mineral', usdaNumber: '303', off: 'iron', target: 8, targetKind: 'floor' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', kind: 'mineral', usdaNumber: '304', off: 'magnesium', target: 400, targetKind: 'floor' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', kind: 'mineral', usdaNumber: '309', off: 'zinc', target: 11, targetKind: 'floor' },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', kind: 'mineral', usdaNumber: '305', off: 'phosphorus', target: 700, targetKind: 'floor' },
  { key: 'copper', label: 'Copper', unit: 'mg', kind: 'mineral', usdaNumber: '312', off: 'copper', target: 0.9, targetKind: 'floor' },
  { key: 'manganese', label: 'Manganese', unit: 'mg', kind: 'mineral', usdaNumber: '315', off: 'manganese', target: 2.3, targetKind: 'floor' },
  { key: 'selenium', label: 'Selenium', unit: 'µg', kind: 'mineral', usdaNumber: '317', off: 'selenium', target: 55, targetKind: 'floor' },
  // --- Vitamins ---
  { key: 'vitaminA', label: 'Vitamin A', unit: 'µg', kind: 'vitamin', usdaNumber: '320', off: 'vitamin-a', target: 900, targetKind: 'floor' },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', kind: 'vitamin', usdaNumber: '401', off: 'vitamin-c', target: 90, targetKind: 'floor' },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'µg', kind: 'vitamin', usdaNumber: '328', off: 'vitamin-d', target: 20, targetKind: 'floor' },
  { key: 'vitaminE', label: 'Vitamin E', unit: 'mg', kind: 'vitamin', usdaNumber: '323', off: 'vitamin-e', target: 15, targetKind: 'floor' },
  { key: 'vitaminK', label: 'Vitamin K', unit: 'µg', kind: 'vitamin', usdaNumber: '430', off: 'vitamin-k', target: 120, targetKind: 'floor' },
  { key: 'thiamin', label: 'Thiamin (B1)', unit: 'mg', kind: 'vitamin', usdaNumber: '404', off: 'vitamin-b1', target: 1.2, targetKind: 'floor' },
  { key: 'riboflavin', label: 'Riboflavin (B2)', unit: 'mg', kind: 'vitamin', usdaNumber: '405', off: 'vitamin-b2', target: 1.3, targetKind: 'floor' },
  { key: 'niacin', label: 'Niacin (B3)', unit: 'mg', kind: 'vitamin', usdaNumber: '406', off: 'vitamin-pp', target: 16, targetKind: 'floor' },
  { key: 'vitaminB6', label: 'Vitamin B6', unit: 'mg', kind: 'vitamin', usdaNumber: '415', off: 'vitamin-b6', target: 1.3, targetKind: 'floor' },
  { key: 'vitaminB12', label: 'Vitamin B12', unit: 'µg', kind: 'vitamin', usdaNumber: '418', off: 'vitamin-b12', target: 2.4, targetKind: 'floor' },
  { key: 'folate', label: 'Folate (DFE)', unit: 'µg', kind: 'vitamin', usdaNumber: '435', off: 'vitamin-b9', target: 400, targetKind: 'floor' },
  { key: 'pantothenicAcid', label: 'Pantothenic acid', unit: 'mg', kind: 'vitamin', usdaNumber: '410', off: 'pantothenic-acid', target: 5, targetKind: 'floor' },
  { key: 'choline', label: 'Choline', unit: 'mg', kind: 'vitamin', usdaNumber: '421', off: 'choline', target: 550, targetKind: 'floor' },
  // --- Other ---
  { key: 'water', label: 'Water', unit: 'g', kind: 'other', usdaNumber: '255', off: 'water', targetKind: 'none' },
  { key: 'caffeine', label: 'Caffeine', unit: 'mg', kind: 'other', usdaNumber: '262', off: 'caffeine', targetKind: 'none' },
  { key: 'alcohol', label: 'Alcohol', unit: 'g', kind: 'other', usdaNumber: '221', off: 'alcohol', targetKind: 'none' },
]

export const NUTRIENT_BY_KEY: Record<NutrientKey, NutrientDef> = Object.fromEntries(
  NUTRIENTS.map((n) => [n.key, n]),
) as Record<NutrientKey, NutrientDef>

export const MACRO_KEYS = ['protein', 'carbs', 'fat'] as const
export const ATWATER = { protein: 4, carbs: 4, fat: 9, alcohol: 7 } as const

/** Scale a per-100g nutrient map by an arbitrary gram amount. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const factor = grams / 100
  const out: Nutrients = {}
  for (const [k, v] of Object.entries(per100g)) {
    if (typeof v === 'number') out[k as NutrientKey] = v * factor
  }
  return out
}

/** Seed micronutrient floors/ceilings from the reference defaults (excludes core macros). */
export function defaultMicroLimits(): Partial<Record<NutrientKey, { kind: TargetKind; value: number }>> {
  const out: Partial<Record<NutrientKey, { kind: TargetKind; value: number }>> = {}
  for (const n of NUTRIENTS) {
    if (n.key === 'protein') continue // protein is a primary macro target
    if (n.targetKind !== 'none' && n.target != null) out[n.key] = { kind: n.targetKind, value: n.target }
  }
  return out
}

/** Sum a list of nutrient maps (e.g. all items logged on a day). */
export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {}
  for (const n of list) {
    for (const [k, v] of Object.entries(n)) {
      if (typeof v === 'number') out[k as NutrientKey] = (out[k as NutrientKey] ?? 0) + v
    }
  }
  return out
}
