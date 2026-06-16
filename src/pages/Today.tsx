import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { logWeight } from '@/data/weight'
import { todayISO } from '@/lib/util'
import { usePrefs } from '@/lib/prefs'
import { toKg, fromKg, formatWeight } from '@/lib/units'

// Phase 0 placeholder Today view. It proves the end-to-end write path: logging a
// weight writes to the local cache instantly (offline-safe) and queues a sync.
// Phase 1 replaces the body with food logging + macro rings.

export function Today() {
  const today = todayISO()
  const unit = usePrefs((s) => s.weightUnit)
  const weights = useLiveQuery(
    () => db.weight_entries.orderBy('date').filter((w) => !w.deleted).reverse().limit(7).toArray(),
    [],
    [],
  )
  const latest = weights?.[0]

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-medium text-muted">Today · {today}</h2>
        <p className="mt-1 text-2xl font-semibold">Welcome 👋</p>
        <p className="mt-1 text-sm text-muted">
          Phase 0 skeleton. Food logging, macro rings, and the dashboard land in the next phases.
        </p>
      </section>

      <WeightDemo latestTrend={latest?.trend_kg ?? null} unit={unit} />

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted">Recent weigh-ins</h3>
        {weights && weights.length > 0 ? (
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
            {weights.map((w) => (
              <li key={w.client_uuid} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-muted">{w.date}</span>
                <span>
                  {formatWeight(w.weight_kg, unit)}
                  {w.trend_kg != null && (
                    <span className="ml-2 text-xs text-muted">
                      trend {fromKg(w.trend_kg, unit).toFixed(1)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No weigh-ins yet. Log one above to test sync.</p>
        )}
      </section>
    </div>
  )
}

function WeightDemo({ latestTrend, unit }: { latestTrend: number | null; unit: 'kg' | 'lb' }) {
  const [value, setValue] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const entered = parseFloat(value)
    if (!Number.isFinite(entered) || entered <= 0) return
    await logWeight(toKg(entered, unit)) // always stored as kg
    setValue('')
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-sm font-medium">Quick weigh-in</h3>
      <p className="mb-3 text-xs text-muted">
        Writes locally first, then syncs to Supabase — works offline.
        {latestTrend != null && ` Current trend: ${formatWeight(latestTrend, unit)}.`}
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={unit}
          aria-label={`Weight in ${unit === 'kg' ? 'kilograms' : 'pounds'}`}
          className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 font-medium text-black"
        >
          Log
        </button>
      </form>
    </section>
  )
}
