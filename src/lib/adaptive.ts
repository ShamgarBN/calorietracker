// Adaptive expenditure (TDEE) estimation — the heart of the tracker.
//
// Principle: over any window, energy expenditure = energy intake − change in body
// energy. Body-energy change ≈ Δ(trend weight) × 7700 kcal/kg. Using the SMOOTHED
// trend weight (EWMA) rather than raw daily weight removes day-to-day water noise.
//
//   estTDEE = meanDailyIntake − (Δtrend_kg × 7700) / spanDays
//
// We then blend this observation with the prior estimate, weighted by how much we
// trust the window (logged-day coverage + weigh-in density), so one sparse or noisy
// week can't swing the target wildly. Cold start falls back to the Mifflin baseline.

import { KCAL_PER_KG } from './constants'

export interface AdaptiveInput {
  /** date → logged calories for that day */
  dailyEnergy: Map<string, number>
  /** weigh-ins with smoothed trend, ascending by date */
  weights: { date: string; trend_kg: number | null }[]
  /** current calorie target — used to judge which days were "fully" logged */
  targetEnergy: number
  /** previous adaptive estimate, if any */
  priorEstimate: number | null
  /** Mifflin-St Jeor TDEE for cold start */
  baselineTDEE: number | null
  windowDays?: number
  /** today's date (injected for testability) */
  today: string
}

export interface AdaptiveResult {
  estimate: number
  confidence: number // 0..1
  meanIntake: number
  trendDeltaKg: number
  spanDays: number
  loggedDays: number
  /** human-readable "why it changed" */
  note: string
  /** true when we had enough data to trust the observation at all */
  usable: boolean
}

const MIN_LOGGED_DAYS = 5
const MIN_WEIGHINS = 2

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function estimateExpenditure(input: AdaptiveInput): AdaptiveResult {
  const windowDays = input.windowDays ?? 14
  const windowStart = addDays(input.today, -windowDays)
  const prior = input.priorEstimate ?? input.baselineTDEE ?? null

  // Days "fully" logged: intake at least half the target (filters partial days that
  // would bias the mean downward). targetEnergy may be 0 if no goals set yet.
  const minDayKcal = Math.max(800, input.targetEnergy * 0.5)
  const logged: number[] = []
  for (const [date, kcal] of input.dailyEnergy) {
    if (date >= windowStart && date <= input.today && kcal >= minDayKcal) logged.push(kcal)
  }
  const loggedDays = logged.length
  const meanIntake = loggedDays ? Math.round(logged.reduce((s, v) => s + v, 0) / loggedDays) : 0

  // Trend-weight delta across the window (first vs last weigh-in that has a trend).
  const inWindow = input.weights.filter((w) => w.trend_kg != null && w.date >= windowStart && w.date <= input.today)
  const first = inWindow[0]
  const last = inWindow[inWindow.length - 1]
  const spanDays = first && last ? Math.max(0, daysBetween(first.date, last.date)) : 0
  const trendDeltaKg = first && last ? (last.trend_kg as number) - (first.trend_kg as number) : 0

  const haveObservation =
    loggedDays >= MIN_LOGGED_DAYS && inWindow.length >= MIN_WEIGHINS && spanDays >= 5

  if (!haveObservation) {
    const estimate = Math.round(prior ?? meanIntake ?? 0)
    return {
      estimate,
      confidence: 0,
      meanIntake,
      trendDeltaKg,
      spanDays,
      loggedDays,
      usable: false,
      note:
        `Not enough data yet (${loggedDays} fully-logged day${loggedDays === 1 ? '' : 's'}, ` +
        `${inWindow.length} weigh-in${inWindow.length === 1 ? '' : 's'} in ${windowDays} days). ` +
        `Keep logging — using your ${prior ? 'baseline' : 'average'} estimate for now.`,
    }
  }

  const observed = Math.round(meanIntake - (trendDeltaKg * KCAL_PER_KG) / spanDays)

  // Confidence: want roughly-daily logs AND ~weekly weigh-ins across the window.
  const coverage = Math.min(loggedDays / windowDays, 1)
  const weighinDensity = Math.min(inWindow.length / (windowDays / 7 + 1), 1)
  const confidence = Math.round(coverage * weighinDensity * 100) / 100

  const estimate = prior == null ? observed : Math.round(confidence * observed + (1 - confidence) * prior)

  const dir = trendDeltaKg < -0.05 ? 'fell' : trendDeltaKg > 0.05 ? 'rose' : 'held steady'
  const note =
    `Over ${spanDays} days your trend weight ${dir} ${Math.abs(trendDeltaKg).toFixed(2)} kg while you ` +
    `averaged ${meanIntake} kcal/day → estimated expenditure ≈ ${observed} kcal/day ` +
    `(confidence ${Math.round(confidence * 100)}%).`

  return { estimate, confidence, meanIntake, trendDeltaKg, spanDays, loggedDays, usable: true, note }
}
