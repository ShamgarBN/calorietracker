import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from 'recharts'
import { Flame } from 'lucide-react'
import { db } from '@/lib/db'
import { getCurrentTarget } from '@/data/targets'
import { groupDailyTotals, buildSeries, currentStreak, adherenceRate, average } from '@/lib/analytics'
import { usePrefs } from '@/lib/prefs'
import { fromKg, weightUnitFor } from '@/lib/units'
import { AdaptiveCard } from '@/components/AdaptiveCard'
import { MicroReport } from '@/components/MicroReport'

const RANGES = [
  { days: 14, label: '14d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
]

export function Trends() {
  const unit = weightUnitFor(usePrefs((s) => s.system))
  const [range, setRange] = useState(14)

  const entries = useLiveQuery(() => db.log_entries.toArray(), [], [])
  const target = useLiveQuery(() => getCurrentTarget(), [])
  const weights = useLiveQuery(
    () => db.weight_entries.orderBy('date').filter((w) => !w.deleted).toArray(),
    [],
    [],
  )

  const { series, streak, avgKcal, adherence } = useMemo(() => {
    const daily = groupDailyTotals(entries ?? [])
    const series = buildSeries(daily, range)
    return {
      series,
      streak: currentStreak(daily),
      avgKcal: average(series, 'energy'),
      adherence: target ? adherenceRate(series, target.energy) : null,
    }
  }, [entries, range, target])

  const chartData = series.map((p) => ({ date: p.date.slice(5), kcal: p.energy, logged: p.logged }))
  const weightData = (weights ?? []).map((w) => ({
    date: w.date.slice(5),
    weight: Number(fromKg(w.weight_kg, unit).toFixed(2)),
    trend: w.trend_kg == null ? null : Number(fromKg(w.trend_kg, unit).toFixed(2)),
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Trends</h2>
        <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1 text-xs ${range === r.days ? 'bg-[var(--color-brand)] font-medium text-black' : 'text-muted'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Streak" value={`${streak}`} sub="days" icon={<Flame size={14} className="text-[var(--color-carbs)]" />} />
        <StatCard label="Avg intake" value={`${avgKcal}`} sub="kcal/day" />
        <StatCard label="Adherence" value={adherence == null ? '—' : `${Math.round(adherence * 100)}%`} sub="on target" />
      </div>

      <AdaptiveCard />

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-sm font-medium text-muted">Calories vs target</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="var(--color-muted)" fontSize={10} interval="preserveStartEnd" />
            <YAxis stroke="var(--color-muted)" fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-surface-2)' }} />
            {target && <ReferenceLine y={target.energy} stroke="var(--color-brand)" strokeDasharray="4 4" />}
            <Bar dataKey="kcal" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={target && d.kcal > target.energy ? 'var(--color-warn)' : 'var(--color-fat)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {target && <p className="mt-2 text-center text-xs text-muted">Dashed line = {target.energy} kcal target</p>}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-sm font-medium text-muted">Weight ({unit}) — raw vs. trend</h3>
        {weightData.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="var(--color-muted)" fontSize={10} />
              <YAxis stroke="var(--color-muted)" fontSize={10} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="weight" stroke="var(--color-muted)" dot={false} strokeWidth={1} />
              <Line type="monotone" dataKey="trend" stroke="var(--color-brand)" dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted">Log a few weigh-ins to see your trend line.</p>
        )}
      </section>

      <MicroReport />
    </div>
  )
}

const tooltipStyle = {
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-text)',
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-xl font-semibold tabular-nums">
        {icon}
        {value}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[10px] text-muted">{sub}</div>
    </div>
  )
}
