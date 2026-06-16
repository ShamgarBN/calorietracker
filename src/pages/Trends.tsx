import { useLiveQuery } from 'dexie-react-hooks'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { db } from '@/lib/db'
import { usePrefs } from '@/lib/prefs'
import { fromKg } from '@/lib/units'

// Phase 0: a real weight-trend chart (raw + smoothed) so the charting stack is
// proven. Macro/adherence/micronutrient trends arrive in Phases 2–3.

export function Trends() {
  const unit = usePrefs((s) => s.weightUnit)
  const weights = useLiveQuery(
    () => db.weight_entries.orderBy('date').filter((w) => !w.deleted).toArray(),
    [],
    [],
  )

  const data = (weights ?? []).map((w) => ({
    date: w.date.slice(5),
    weight: Number(fromKg(w.weight_kg, unit).toFixed(2)),
    trend: w.trend_kg == null ? null : Number(fromKg(w.trend_kg, unit).toFixed(2)),
  }))

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Trends</h2>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-sm font-medium text-muted">Weight ({unit}) — raw vs. trend</h3>
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="var(--color-muted)" fontSize={11} />
              <YAxis stroke="var(--color-muted)" fontSize={11} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text)',
                }}
              />
              <Line type="monotone" dataKey="weight" stroke="var(--color-muted)" dot={false} strokeWidth={1} />
              <Line type="monotone" dataKey="trend" stroke="var(--color-brand)" dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted">Log a few weigh-ins to see your trend line.</p>
        )}
      </section>
    </div>
  )
}
