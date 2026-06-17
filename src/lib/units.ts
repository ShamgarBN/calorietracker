import { kgToLb, lbToKg } from './util'

export type UnitSystem = 'imperial' | 'metric'
export type WeightUnit = 'kg' | 'lb'

export const weightUnitFor = (system: UnitSystem): WeightUnit => (system === 'imperial' ? 'lb' : 'kg')

// ---- body weight (stored as kg) -------------------------------------------
/** Convert a user-entered value in their chosen unit to kg (the storage unit). */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? lbToKg(value) : value
}

/** Convert a stored kg value to the user's chosen unit for display. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kgToLb(kg) : kg
}

export function formatWeight(kg: number, unit: WeightUnit, digits = 1): string {
  return `${fromKg(kg, unit).toFixed(digits)} ${unit}`
}

// ---- food mass (stored as grams) ------------------------------------------
const GRAMS_PER_OZ = 28.349523125

export const gramsToOz = (g: number) => g / GRAMS_PER_OZ
export const ozToGrams = (oz: number) => oz * GRAMS_PER_OZ

/** Display a gram amount in the active system: "3.5 oz" (imperial) or "100 g" (metric). */
export function formatMass(grams: number, system: UnitSystem, digits = 1): string {
  return system === 'imperial' ? `${gramsToOz(grams).toFixed(digits)} oz` : `${Math.round(grams)} g`
}

/** The direct-entry mass unit + grams-per-unit for the active system. */
export function massUnit(system: UnitSystem): { label: string; grams: number } {
  return system === 'imperial' ? { label: 'ounce (oz)', grams: GRAMS_PER_OZ } : { label: 'gram (g)', grams: 1 }
}

/** Rewrite gram weights inside a serving label to oz when imperial ("100 g" → "3.5 oz"). */
export function localizeServingLabel(label: string, system: UnitSystem): string {
  if (system !== 'imperial') return label
  return label.replace(/([\d.]+)\s*g\b/g, (_, n) => `${gramsToOz(parseFloat(n)).toFixed(1)} oz`)
}

// ---- water/volume (stored as ml) ------------------------------------------
const ML_PER_FLOZ = 29.5735

export const mlToFloz = (ml: number) => ml / ML_PER_FLOZ
export const flozToMl = (floz: number) => floz * ML_PER_FLOZ

export function formatVolume(ml: number, system: UnitSystem): string {
  return system === 'imperial' ? `${Math.round(mlToFloz(ml))} fl oz` : `${Math.round(ml)} ml`
}
