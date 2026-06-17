// Static target computation: Mifflin-St Jeor BMR → TDEE → calorie + macro targets.
//
// This is the COLD-START / manual baseline. In Phase 3 the adaptive engine replaces
// the TDEE estimate with one derived from real weight-trend + intake data; the macro
// split logic here is reused.

import { KCAL_PER_KG } from './constants'
import type { Profile, Sex } from '@/types/db'

export interface TargetValues {
  energy: number
  protein: number
  carbs: number
  fat: number
}
export interface TargetBreakdown extends TargetValues {
  bmr: number
  tdee: number
  dailyAdjust: number // kcal/day added (surplus) or removed (deficit) for the goal rate
}

const ACTIVITY_FACTOR: Record<Profile['activity_level'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const PROTEIN_G_PER_KG = 1.8 // protein anchored to bodyweight
const FAT_PCT_OF_KCAL = 0.25 // fat as a share of calories (floor for hormones/satiety)
const MIN_CALORIES = 1200 // safety floor

export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'female' ? base - 161 : base + 5
}

/** Split a calorie target into macros: protein by bodyweight, fat by %, carbs fill the rest. */
export function macroSplit(energy: number, weightKg: number): TargetValues {
  const protein = Math.round(PROTEIN_G_PER_KG * weightKg)
  const fat = Math.round((energy * FAT_PCT_OF_KCAL) / 9)
  const carbs = Math.max(0, Math.round((energy - protein * 4 - fat * 9) / 4))
  return { energy, protein, carbs, fat }
}

/** Full static targets from profile + current weight. Returns null if inputs are incomplete. */
export function computeTargets(
  p: Pick<Profile, 'sex' | 'height_cm' | 'birth_year' | 'activity_level' | 'goal_rate_kg_per_week'>,
  weightKg: number,
): TargetBreakdown | null {
  if (!p.sex || !p.height_cm || !p.birth_year || !weightKg) return null
  const age = new Date().getFullYear() - p.birth_year
  const bmr = mifflinStJeor(p.sex, weightKg, p.height_cm, age)
  const tdee = bmr * (ACTIVITY_FACTOR[p.activity_level] ?? 1.55)
  const dailyAdjust = ((p.goal_rate_kg_per_week ?? 0) * KCAL_PER_KG) / 7 // negative for loss
  const energy = Math.max(MIN_CALORIES, Math.round(tdee + dailyAdjust))
  return {
    ...macroSplit(energy, weightKg),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyAdjust: Math.round(dailyAdjust),
  }
}
