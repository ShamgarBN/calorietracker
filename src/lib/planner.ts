// Meal-plan generator: greedy fill + repair (NOT a heavy LP solver — see plan §2C).
//
// For each meal slot we get a calorie budget (a share of the day's target), then
// pick a protein item, a carb item, and a veg/snack to fill it, scaling portions.
// A final repair pass nudges portions to hit the protein target and keep total
// calories within tolerance. Deterministic given `seed` so swaps are reproducible.

import { scaleNutrients, type Nutrients } from './nutrients'
import type { MealSlot } from '@/types/db'

export type FoodRole = 'protein' | 'carb' | 'veg' | 'fat' | 'snack'

export interface PlanCandidate {
  id: string
  name: string
  role: FoodRole
  slots: MealSlot[] // slots this food suits
  /** nutrients per 100g */
  per100g: Nutrients
  minGrams: number
  maxGrams: number
}

export interface PlannedItem {
  slot: MealSlot
  candidateId: string
  name: string
  role: FoodRole
  grams: number
  nutrients: Nutrients // absolute, scaled to grams
  locked?: boolean
}

export interface MacroTarget {
  energy: number
  protein: number
  carbs: number
  fat: number
}

export interface SlotWeight {
  slot: MealSlot
  weight: number
}

const kcalPerGram = (c: PlanCandidate) => (c.per100g.energy ?? 0) / 100
const proteinPerGram = (c: PlanCandidate) => (c.per100g.protein ?? 0) / 100

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function item(c: PlanCandidate, grams: number, slot: MealSlot, locked = false): PlannedItem {
  const g = Math.round(clamp(grams, c.minGrams, c.maxGrams))
  return { slot, candidateId: c.id, name: c.name, role: c.role, grams: g, nutrients: scaleNutrients(c.per100g, g), locked }
}

/** Rotating pick: choose the (seed-th) candidate of a role that fits the slot, avoiding `used`. */
function pick(
  candidates: PlanCandidate[],
  role: FoodRole,
  slot: MealSlot,
  used: Set<string>,
  seed: number,
): PlanCandidate | null {
  const pool = candidates.filter((c) => c.role === role && c.slots.includes(slot) && (c.per100g.energy ?? 0) > 0)
  const fresh = pool.filter((c) => !used.has(c.id))
  const list = fresh.length ? fresh : pool // allow repeats only if nothing fresh
  if (!list.length) return null
  return list[seed % list.length]
}

export function generateDay(input: {
  targets: MacroTarget
  slots: SlotWeight[]
  candidates: PlanCandidate[]
  locked?: PlannedItem[]
  seed?: number
}): PlannedItem[] {
  const { targets, slots, candidates } = input
  const locked = input.locked ?? []
  const seed = input.seed ?? 0
  const used = new Set<string>(locked.map((l) => l.candidateId))

  // Budget remaining after locked items.
  const lockedEnergy = locked.reduce((s, l) => s + (l.nutrients.energy ?? 0), 0)
  const lockedProtein = locked.reduce((s, l) => s + (l.nutrients.protein ?? 0), 0)
  const totalWeight = slots.reduce((s, x) => s + x.weight, 0) || 1
  const remEnergy = Math.max(0, targets.energy - lockedEnergy)
  const remProtein = Math.max(0, targets.protein - lockedProtein)

  const out: PlannedItem[] = [...locked]

  for (const { slot, weight } of slots) {
    const share = weight / totalWeight
    let slotKcal = remEnergy * share
    const slotProtein = remProtein * share

    // 1) Protein anchor.
    const p = pick(candidates, 'protein', slot, used, seed)
    if (p) {
      const grams = slotProtein / Math.max(proteinPerGram(p), 0.001)
      const it = item(p, grams, slot)
      out.push(it)
      used.add(p.id)
      slotKcal -= it.nutrients.energy ?? 0
    }

    // 2) Carb to fill ~70% of what's left.
    const c = pick(candidates, 'carb', slot, used, seed)
    if (c && slotKcal > 40) {
      const grams = (slotKcal * 0.7) / Math.max(kcalPerGram(c), 0.001)
      const it = item(c, grams, slot)
      out.push(it)
      used.add(c.id)
      slotKcal -= it.nutrients.energy ?? 0
    }

    // 3) Veg/snack/fat to fill the rest.
    const role: FoodRole = slot === 'snack' ? 'snack' : 'veg'
    const v = pick(candidates, role, slot, used, seed) ?? pick(candidates, 'snack', slot, used, seed)
    if (v && slotKcal > 30) {
      const grams = slotKcal / Math.max(kcalPerGram(v), 0.001)
      const it = item(v, grams, slot)
      out.push(it)
      used.add(v.id)
    }
  }

  return repair(out, targets)
}

/** Nudge portions to hit protein (≥92%) and keep calories within ±8%. */
function repair(items: PlannedItem[], targets: MacroTarget): PlannedItem[] {
  const sum = (key: keyof Nutrients) => items.reduce((s, it) => s + (it.nutrients[key] ?? 0), 0)

  // Protein: scale up the biggest unlocked protein item toward the target.
  let protein = sum('protein')
  if (protein < targets.protein * 0.92) {
    const p = items
      .filter((it) => it.role === 'protein' && !it.locked)
      .sort((a, b) => (b.nutrients.protein ?? 0) - (a.nutrients.protein ?? 0))[0]
    if (p) {
      const deficit = targets.protein - protein
      const ppg = (p.nutrients.protein ?? 0) / p.grams
      if (ppg > 0) rescale(p, p.grams + deficit / ppg)
      protein = sum('protein')
    }
  }

  // Calories: scale carb/veg items proportionally to land within tolerance.
  const energy = sum('energy')
  if (energy > 0) {
    const hi = targets.energy * 1.08
    const lo = targets.energy * 0.92
    if (energy > hi || energy < lo) {
      const target = clamp(targets.energy, lo, hi)
      const adjustable = items.filter((it) => (it.role === 'carb' || it.role === 'veg' || it.role === 'snack') && !it.locked)
      const adjEnergy = adjustable.reduce((s, it) => s + (it.nutrients.energy ?? 0), 0)
      const fixedEnergy = energy - adjEnergy
      const wanted = Math.max(0, target - fixedEnergy)
      const factor = adjEnergy > 0 ? wanted / adjEnergy : 1
      for (const it of adjustable) rescale(it, it.grams * factor)
    }
  }

  return items
}

function rescale(it: PlannedItem, grams: number) {
  const per100 = scaleNutrients(it.nutrients, 100 / Math.max(it.grams, 1)) // back to per-100g
  it.grams = Math.max(1, Math.round(grams))
  it.nutrients = scaleNutrients(per100, it.grams)
}

export function planTotals(items: PlannedItem[]): MacroTarget {
  return {
    energy: Math.round(items.reduce((s, it) => s + (it.nutrients.energy ?? 0), 0)),
    protein: Math.round(items.reduce((s, it) => s + (it.nutrients.protein ?? 0), 0)),
    carbs: Math.round(items.reduce((s, it) => s + (it.nutrients.carbs ?? 0), 0)),
    fat: Math.round(items.reduce((s, it) => s + (it.nutrients.fat ?? 0), 0)),
  }
}
