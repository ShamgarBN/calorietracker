import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { currentUserId } from '@/lib/supabase'
import { uuid, todayISO } from '@/lib/util'
import { estimateExpenditure, type AdaptiveResult } from '@/lib/adaptive'
import { computeTargets, macroSplit } from '@/lib/targets'
import { KCAL_PER_KG } from '@/lib/constants'
import { groupDailyTotals } from '@/lib/analytics'
import { getCurrentTarget, saveTarget } from './targets'
import { getProfile } from './profile'
import type { TdeeEstimate } from '@/types/db'

/** Monday of the ISO week containing `iso`. */
function weekStartISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const dow = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - dow)
  return d.toISOString().slice(0, 10)
}

export async function getLatestEstimate(): Promise<TdeeEstimate | undefined> {
  const all = await db.tdee_estimates.orderBy('created_at').toArray()
  return all[all.length - 1]
}

/** Gather inputs and compute the current adaptive expenditure estimate (no writes). */
export async function computeCurrentExpenditure(): Promise<AdaptiveResult> {
  const today = todayISO()
  const [entries, weights, target, prior, profile] = await Promise.all([
    db.log_entries.toArray(),
    db.weight_entries.orderBy('date').filter((w) => !w.deleted).toArray(),
    getCurrentTarget(),
    getLatestEstimate(),
    getProfile(),
  ])

  const dailyEnergy = new Map<string, number>()
  for (const [date, n] of groupDailyTotals(entries)) dailyEnergy.set(date, Math.round(n.energy ?? 0))

  const currentKg = weights.length ? weights[weights.length - 1].weight_kg : null
  const baseline = profile && currentKg != null ? computeTargets(profile, currentKg)?.tdee ?? null : null

  return estimateExpenditure({
    dailyEnergy,
    weights: weights.map((w) => ({ date: w.date, trend_kg: w.trend_kg })),
    targetEnergy: target?.energy ?? 0,
    priorEstimate: prior?.estimate_kcal ?? null,
    baselineTDEE: baseline,
    today,
  })
}

/**
 * Apply the adaptive estimate: persist a weekly estimate row and a new target that
 * keeps the user's goal rate. Returns the result that was applied.
 */
export async function applyAdaptiveTargets(): Promise<AdaptiveResult> {
  const result = await computeCurrentExpenditure()
  const userId = await currentUserId()
  const today = todayISO()

  const [profile, weights] = await Promise.all([
    getProfile(),
    db.weight_entries.orderBy('date').filter((w) => !w.deleted).toArray(),
  ])
  const currentKg = weights.length ? weights[weights.length - 1].weight_kg : null

  // New calorie target = estimated expenditure + the goal-rate adjustment.
  const dailyAdjust = ((profile?.goal_rate_kg_per_week ?? 0) * KCAL_PER_KG) / 7
  const energy = Math.max(1200, Math.round(result.estimate + dailyAdjust))
  const macros = macroSplit(energy, currentKg ?? 70)
  await saveTarget(macros, { origin: 'adaptive' })

  // Persist (or update) this week's estimate.
  const weekStart = weekStartISO(today)
  const existing = await db.tdee_estimates.where('week_start').equals(weekStart).first()
  const now = new Date().toISOString()
  const row: TdeeEstimate = {
    id: existing?.id ?? uuid(),
    user_id: userId,
    week_start: weekStart,
    estimate_kcal: result.estimate,
    confidence: result.confidence,
    mean_intake_kcal: result.meanIntake,
    trend_delta_kg: result.trendDeltaKg,
    note: result.note,
    created_at: existing?.created_at ?? now,
  }
  await queueMutation({
    table: 'tdee_estimates',
    op: 'upsert',
    payload: row as unknown as Record<string, unknown>,
    client_uuid: row.id,
    localApply: async () => {
      await db.tdee_estimates.put(row)
    },
  })

  return result
}
