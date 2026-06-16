import { kgToLb, lbToKg } from './util'

export type WeightUnit = 'kg' | 'lb'

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
