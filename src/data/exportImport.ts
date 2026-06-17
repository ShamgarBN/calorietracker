import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import type { LogEntry } from '@/types/db'

// Full data ownership: export everything to round-trippable JSON, the food log to
// CSV, and import a JSON backup back through the sync outbox.

// table -> key column used for upsert/dedupe.
const TABLE_KEY: Record<string, string> = {
  foods: 'id',
  log_entries: 'client_uuid',
  weight_entries: 'client_uuid',
  targets: 'id',
  tdee_estimates: 'id',
  meals: 'id',
  recipes: 'id',
  profile: 'user_id',
}
const TABLES = Object.keys(TABLE_KEY)

export async function exportAllJson(): Promise<Blob> {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) {
    // @ts-expect-error dynamic table access
    data[t] = await db[t].toArray()
  }
  const payload = { app: 'calorie-tracker', schema: 1, exportedAt: new Date().toISOString(), data }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

const CSV_COLS = ['date', 'meal_slot', 'source', 'description', 'grams', 'energy', 'protein', 'carbs', 'fat'] as const

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportLogCsv(): Promise<Blob> {
  const rows = (await db.log_entries.toArray()).filter((e) => !e.deleted)
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  const lines = [CSV_COLS.join(',')]
  for (const e of rows) {
    lines.push(
      [e.date, e.meal_slot, e.source, e.description, Math.round(e.grams),
        Math.round(e.nutrients.energy ?? 0), Math.round(e.nutrients.protein ?? 0),
        Math.round(e.nutrients.carbs ?? 0), Math.round(e.nutrients.fat ?? 0)]
        .map(csvCell).join(','),
    )
  }
  return new Blob([lines.join('\n')], { type: 'text/csv' })
}

export interface ImportResult {
  counts: Record<string, number>
  total: number
}

export async function importJson(text: string): Promise<ImportResult> {
  const parsed = JSON.parse(text)
  if (!parsed?.data || typeof parsed.data !== 'object') throw new Error('Not a valid export file')
  const counts: Record<string, number> = {}
  let total = 0

  for (const t of TABLES) {
    const rows = parsed.data[t]
    if (!Array.isArray(rows)) continue
    const key = TABLE_KEY[t]
    counts[t] = 0
    for (const row of rows as Record<string, unknown>[]) {
      const keyVal = row[key]
      if (keyVal == null) continue
      await queueMutation({
        table: t as keyof typeof TABLE_KEY,
        op: 'upsert',
        payload: row,
        client_uuid: String(keyVal),
        localApply: async () => {
          // @ts-expect-error dynamic table access
          await db[t].put(row)
        },
      })
      counts[t]++
      total++
    }
  }
  return { counts, total }
}

/** Trigger a browser download of a blob. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type { LogEntry }
