import type { Nutrients } from '@/lib/nutrients'
import type { Serving } from '@/types/db'

// A normalized food returned by the search proxy, not yet persisted as a Food row.
// Matches the FoodResult shape emitted by supabase/functions/tracker-food-search.
export interface FoodResult {
  source: 'usda' | 'off'
  source_id: string
  barcode: string | null
  name: string
  brand: string | null
  is_generic: boolean
  nutrients: Nutrients // per 100g
  servings: Serving[]
  default_serving: number
}
