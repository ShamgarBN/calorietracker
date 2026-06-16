import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Zap, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import { logWeight } from '@/data/weight'
import { deleteEntry, dayTotals } from '@/data/log'
import { getCurrentTarget } from '@/data/targets'
import { todayISO } from '@/lib/util'
import { usePrefs } from '@/lib/prefs'
import { toKg, formatWeight } from '@/lib/units'
import { MEAL_SLOTS } from '@/components/MealSlotSelect'
import { LogFoodSheet } from '@/components/LogFoodSheet'
import { QuickAddSheet } from '@/components/QuickAddSheet'
import { ProgressRing, MacroBar } from '@/components/ProgressRing'
import type { LogEntry, MealSlot, TargetRow } from '@/types/db'
import type { Nutrients } from '@/lib/nutrients'

export function Today() {
  const today = todayISO()
  const [foodSheet, setFoodSheet] = useState<MealSlot | null>(null)
  const [quickSheet, setQuickSheet] = useState<MealSlot | null>(null)

  const entries =
    useLiveQuery(
      () => db.log_entries.where('date').equals(today).toArray(),
      [today],
      [] as LogEntry[],
    ).filter((e) => !e.deleted) ?? []

  const totals = dayTotals(entries)
  const target = useLiveQuery(() => getCurrentTarget(today), [today])

  return (
    <div className="space-y-6">
      <DayDashboard totals={totals} target={target} onQuickAdd={() => setQuickSheet('snack')} />

      {MEAL_SLOTS.map((slot) => {
        const slotEntries = entries.filter((e) => e.meal_slot === slot.value)
        const slotKcal = Math.round(dayTotals(slotEntries).energy ?? 0)
        return (
          <section key={slot.value}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {slot.label}
                {slotKcal > 0 && <span className="ml-2 text-xs text-muted">{slotKcal} kcal</span>}
              </h3>
              <button
                onClick={() => setFoodSheet(slot.value)}
                className="flex items-center gap-1 text-sm text-[var(--color-brand)]"
              >
                <Plus size={16} /> Add
              </button>
            </div>
            {slotEntries.length > 0 ? (
              <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
                {slotEntries.map((e) => (
                  <EntryRow key={e.client_uuid} entry={e} />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-3 text-xs text-muted">
                Nothing logged yet.
              </p>
            )}
          </section>
        )
      })}

      <WeighInCard />

      <LogFoodSheet
        open={foodSheet !== null}
        onClose={() => setFoodSheet(null)}
        mealSlot={foodSheet ?? 'snack'}
        date={today}
      />
      <QuickAddSheet
        open={quickSheet !== null}
        onClose={() => setQuickSheet(null)}
        mealSlot={quickSheet ?? 'snack'}
        date={today}
      />
    </div>
  )
}

function DayDashboard({
  totals,
  target,
  onQuickAdd,
}: {
  totals: Nutrients
  target: TargetRow | undefined
  onQuickAdd: () => void
}) {
  const eaten = Math.round(totals.energy ?? 0)

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Today</h2>
        <button
          onClick={onQuickAdd}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
        >
          <Zap size={14} /> Quick add
        </button>
      </div>

      {target ? (
        <>
          <div className="flex items-center gap-4">
            <ProgressRing value={eaten} target={target.energy}>
              <span className="text-2xl font-semibold tabular-nums">{Math.max(0, target.energy - eaten)}</span>
              <span className="text-[11px] text-muted">kcal left</span>
            </ProgressRing>
            <div className="flex-1 space-y-2.5">
              <MacroBar label="Protein" value={totals.protein ?? 0} target={target.protein} color="var(--color-protein)" />
              <MacroBar label="Carbs" value={totals.carbs ?? 0} target={target.carbs} color="var(--color-carbs)" />
              <MacroBar label="Fat" value={totals.fat ?? 0} target={target.fat} color="var(--color-fat)" />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            {eaten} eaten · {target.energy} target
          </p>
        </>
      ) : (
        <div className="text-center">
          <p className="text-3xl font-semibold tabular-nums">{eaten}<span className="ml-1 text-base font-normal text-muted">kcal</span></p>
          <Link
            to="/settings"
            className="mt-3 inline-block rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-black"
          >
            Set your goals →
          </Link>
          <p className="mt-2 text-xs text-muted">Add targets to see progress rings and remaining budget.</p>
        </div>
      )}
    </section>
  )
}

function EntryRow({ entry }: { entry: LogEntry }) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm">{entry.description}</p>
        <p className="truncate text-xs text-muted">
          {entry.grams > 0 ? `${Math.round(entry.grams)} g · ` : ''}
          {Math.round(entry.nutrients.protein ?? 0)}P · {Math.round(entry.nutrients.carbs ?? 0)}C ·{' '}
          {Math.round(entry.nutrients.fat ?? 0)}F
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm tabular-nums">{Math.round(entry.nutrients.energy ?? 0)}</span>
        <button
          onClick={() => void deleteEntry(entry.client_uuid)}
          aria-label={`Delete ${entry.description}`}
          className="text-muted hover:text-[var(--color-warn)]"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  )
}

function WeighInCard() {
  const unit = usePrefs((s) => s.weightUnit)
  const [value, setValue] = useState('')
  const latest = useLiveQuery(
    () => db.weight_entries.orderBy('date').filter((w) => !w.deleted).last(),
    [],
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const entered = parseFloat(value)
    if (!Number.isFinite(entered) || entered <= 0) return
    await logWeight(toKg(entered, unit))
    setValue('')
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Weigh-in</h3>
        {latest?.trend_kg != null && (
          <span className="text-xs text-muted">trend {formatWeight(latest.trend_kg, unit)}</span>
        )}
      </div>
      <form onSubmit={submit} className="mt-2 flex gap-2">
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
        <button type="submit" className="rounded-lg bg-[var(--color-brand)] px-4 py-2 font-medium text-black">
          Log
        </button>
      </form>
    </section>
  )
}
