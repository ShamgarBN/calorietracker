import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Zap, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import { logWeight } from '@/data/weight'
import { deleteEntry, dayTotals } from '@/data/log'
import { todayISO } from '@/lib/util'
import { usePrefs } from '@/lib/prefs'
import { toKg, formatWeight } from '@/lib/units'
import { MEAL_SLOTS } from '@/components/MealSlotSelect'
import { LogFoodSheet } from '@/components/LogFoodSheet'
import { QuickAddSheet } from '@/components/QuickAddSheet'
import type { LogEntry, MealSlot } from '@/types/db'

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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Today</h2>
            <p className="text-3xl font-semibold tabular-nums">
              {Math.round(totals.energy ?? 0)}
              <span className="ml-1 text-base font-normal text-muted">kcal</span>
            </p>
          </div>
          <button
            onClick={() => setQuickSheet('snack')}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            <Zap size={14} /> Quick add
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Macro label="Protein" value={totals.protein} tone="text-[var(--color-protein)]" />
          <Macro label="Carbs" value={totals.carbs} tone="text-[var(--color-carbs)]" />
          <Macro label="Fat" value={totals.fat} tone="text-[var(--color-fat)]" />
        </div>
        <p className="mt-3 text-center text-xs text-muted">
          Targets &amp; progress rings arrive in Phase 2.
        </p>
      </section>

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

function Macro({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-bg)] py-2">
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{Math.round(value ?? 0)}g</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
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
