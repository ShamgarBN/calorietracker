import { sumNutrients, NUTRIENT_BY_KEY, type Nutrients, type NutrientKey, type TargetKind } from './nutrients'
import { todayISO } from './util'
import type { LogEntry } from '@/types/db'

export interface DayPoint {
  date: string
  energy: number
  protein: number
  carbs: number
  fat: number
  logged: boolean
}

/** Group logged (not planned) entries into per-day nutrient totals. */
export function groupDailyTotals(entries: LogEntry[]): Map<string, Nutrients> {
  const byDate = new Map<string, Nutrients[]>()
  for (const e of entries) {
    if (e.deleted || e.source !== 'logged') continue
    const list = byDate.get(e.date) ?? []
    list.push(e.nutrients)
    byDate.set(e.date, list)
  }
  const out = new Map<string, Nutrients>()
  for (const [date, list] of byDate) out.set(date, sumNutrients(list))
  return out
}

/** Continuous series of the last `rangeDays` days (ending today), 0 for unlogged days. */
export function buildSeries(daily: Map<string, Nutrients>, rangeDays: number): DayPoint[] {
  const out: DayPoint[] = []
  const end = new Date(todayISO() + 'T00:00:00')
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    const date = todayISO(d)
    const n = daily.get(date)
    out.push({
      date,
      energy: Math.round(n?.energy ?? 0),
      protein: Math.round(n?.protein ?? 0),
      carbs: Math.round(n?.carbs ?? 0),
      fat: Math.round(n?.fat ?? 0),
      logged: Boolean(n),
    })
  }
  return out
}

/** Consecutive logged days ending today (or yesterday if today not logged yet). */
export function currentStreak(daily: Map<string, Nutrients>): number {
  let streak = 0
  const cursor = new Date(todayISO() + 'T00:00:00')
  // Allow today to be empty without breaking a streak built through yesterday.
  if (!daily.has(todayISO(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (daily.has(todayISO(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Of the logged days in the series, the share within ±tolerance of the calorie target. */
export function adherenceRate(series: DayPoint[], targetKcal: number, tolerance = 0.1): number | null {
  if (!targetKcal) return null
  const logged = series.filter((p) => p.logged)
  if (!logged.length) return null
  const within = logged.filter((p) => Math.abs(p.energy - targetKcal) <= targetKcal * tolerance)
  return within.length / logged.length
}

export function average(series: DayPoint[], key: keyof DayPoint): number {
  const logged = series.filter((p) => p.logged)
  if (!logged.length) return 0
  return Math.round(logged.reduce((s, p) => s + (p[key] as number), 0) / logged.length)
}

export type MicroStatus = 'short' | 'over' | 'ok'
export interface MicroRow {
  key: NutrientKey
  label: string
  unit: string
  avg: number
  target: number
  kind: TargetKind
  pct: number // avg / target
  status: MicroStatus
}

type MicroLimits = Partial<Record<NutrientKey, { kind: TargetKind; value: number }>>

/** Average daily micronutrient intake over recently-logged days vs floors/ceilings. */
export function microReport(
  daily: Map<string, Nutrients>,
  limits: MicroLimits,
  windowDays = 7,
): { rows: MicroRow[]; loggedDays: number } {
  const cutoff = new Date(todayISO() + 'T00:00:00')
  cutoff.setDate(cutoff.getDate() - (windowDays - 1))
  const cutoffISO = todayISO(cutoff)

  const days = [...daily.entries()].filter(([date, n]) => date >= cutoffISO && (n.energy ?? 0) > 0)
  const rows: MicroRow[] = []
  if (!days.length) return { rows, loggedDays: 0 }

  for (const [k, lim] of Object.entries(limits) as [NutrientKey, { kind: TargetKind; value: number }][]) {
    if (lim.kind === 'none' || !lim.value) continue
    const def = NUTRIENT_BY_KEY[k]
    if (!def) continue
    const avg = days.reduce((s, [, n]) => s + (n[k] ?? 0), 0) / days.length
    const pct = avg / lim.value
    let status: MicroStatus = 'ok'
    if (lim.kind === 'floor' && pct < 0.9) status = 'short'
    if (lim.kind === 'ceiling' && pct > 1.0) status = 'over'
    rows.push({ key: k, label: def.label, unit: def.unit, avg, target: lim.value, kind: lim.kind, pct, status })
  }
  // Problems first (short/over), then by how far off.
  rows.sort((a, b) => {
    const ap = a.status === 'ok' ? 1 : 0
    const bp = b.status === 'ok' ? 1 : 0
    if (ap !== bp) return ap - bp
    return Math.abs(1 - b.pct) - Math.abs(1 - a.pct)
  })
  return { rows, loggedDays: days.length }
}
