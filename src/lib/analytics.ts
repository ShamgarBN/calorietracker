import { sumNutrients, type Nutrients } from './nutrients'
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
