import { supabase } from '@/lib/supabase'
import { CURATED_FOODS } from './curatedFoods'
import type { FoodResult } from '@/types/food'

// Thin client over the tracker-food-search Edge Function. Kept as the SINGLE place
// the app talks to external food data, so the backend (proxy vs. direct) is
// swappable without touching the UI or data layer.

/** Clean curated staples that match all query words — instant + offline. */
function matchCurated(q: string): FoodResult[] {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  return CURATED_FOODS.filter((f) => {
    const n = f.name.toLowerCase()
    return tokens.every((t) => n.includes(t))
  }).slice(0, 6)
}

export async function searchFoods(query: string, pageSize = 20): Promise<FoodResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const curated = matchCurated(q)

  let remote: FoodResult[] = []
  try {
    const { data, error } = await supabase.functions.invoke('tracker-food-search', {
      body: { q, pageSize },
    })
    if (error) throw error
    remote = (data?.results ?? []) as FoodResult[]
  } catch (err) {
    // Offline / function down: still return curated staples if any matched.
    if (!curated.length) throw err
  }

  // Curated staples rank first; dedupe remote by name.
  const seen = new Set(curated.map((f) => f.name.toLowerCase()))
  const merged = [...curated, ...remote.filter((r) => !seen.has(r.name.toLowerCase()))]
  return merged.slice(0, Math.max(pageSize, curated.length))
}

export async function lookupBarcode(barcode: string): Promise<FoodResult | null> {
  const { data, error } = await supabase.functions.invoke('tracker-food-search', {
    body: { barcode },
  })
  if (error) throw error
  return (data?.results?.[0] ?? null) as FoodResult | null
}
