import { supabase } from '@/lib/supabase'
import type { FoodResult } from '@/types/food'

// Thin client over the tracker-food-search Edge Function. Kept as the SINGLE place
// the app talks to external food data, so the backend (proxy vs. direct) is
// swappable without touching the UI or data layer.

export async function searchFoods(query: string, pageSize = 20): Promise<FoodResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const { data, error } = await supabase.functions.invoke('tracker-food-search', {
    body: { q, pageSize },
  })
  if (error) throw error
  return (data?.results ?? []) as FoodResult[]
}

export async function lookupBarcode(barcode: string): Promise<FoodResult | null> {
  const { data, error } = await supabase.functions.invoke('tracker-food-search', {
    body: { barcode },
  })
  if (error) throw error
  return (data?.results?.[0] ?? null) as FoodResult | null
}
