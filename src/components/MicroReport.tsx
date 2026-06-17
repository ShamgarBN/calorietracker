import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { getCurrentTarget } from '@/data/targets'
import { groupDailyTotals, microReport, type MicroRow } from '@/lib/analytics'

// Cronometer-style: average daily micronutrients over the last 7 logged days vs
// floors/ceilings, problems surfaced first.
export function MicroReport() {
  const entries = useLiveQuery(() => db.log_entries.toArray(), [], [])
  const target = useLiveQuery(() => getCurrentTarget(), [])

  const daily = groupDailyTotals(entries ?? [])
  const { rows, loggedDays } = microReport(daily, target?.micro_limits ?? {})

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-1 text-sm font-medium text-muted">Micronutrients</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          {target ? 'Log a day or two of food to see your micronutrient report.' : 'Set goals to enable the micronutrient report.'}
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">7-day average · {loggedDays} logged day{loggedDays === 1 ? '' : 's'}</p>
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <MicroRowView key={r.key} row={r} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function MicroRowView({ row }: { row: MicroRow }) {
  const color =
    row.status === 'short'
      ? 'var(--color-warn)'
      : row.status === 'over'
        ? 'var(--color-carbs)'
        : 'var(--color-brand)'
  const pctWidth = Math.min(row.pct, 1) * 100
  const label = row.status === 'short' ? 'low' : row.status === 'over' ? 'over' : 'ok'

  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span>
          {row.label}
          <span className="ml-1.5 text-[10px] uppercase" style={{ color }}>
            {label}
          </span>
        </span>
        <span className="tabular-nums text-muted">
          {round(row.avg)} / {round(row.target)} {row.unit}
          {row.kind === 'ceiling' && ' max'}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${pctWidth}%`, background: color }} />
      </div>
    </li>
  )
}

function round(n: number): number {
  return n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
}
