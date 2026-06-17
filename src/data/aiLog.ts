import { supabase } from '@/lib/supabase'
import { searchFoods } from './foodSource'
import { saveFoodFromResult } from './foods'
import type { Food } from '@/types/db'

// A parsed item, matched (best-effort) against the food database. The user reviews
// these before anything is logged — we never auto-log the AI's guesses.
export interface ParsedDraft {
  query: string // the AI's food name (e.g. "egg")
  note?: string // original phrase (e.g. "2 eggs")
  grams: number
  food: Food | null // matched food, or null if nothing matched
}

export async function parseMeal(text: string): Promise<ParsedDraft[]> {
  const { data, error } = await supabase.functions.invoke('tracker-parse-food', { body: { text } })
  if (error) throw error
  const items = (data?.items ?? []) as { name: string; grams: number; note?: string }[]

  const drafts: ParsedDraft[] = []
  for (const it of items) {
    let food: Food | null = null
    try {
      const results = await searchFoods(it.name, 1)
      if (results.length) food = await saveFoodFromResult(results[0])
    } catch {
      // leave unmatched; user can fix manually
    }
    drafts.push({ query: it.name, note: it.note, grams: Math.round(it.grams), food })
  }
  return drafts
}
