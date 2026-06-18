import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Zap, Trash2, BookmarkPlus, CopyPlus, Sparkles, Check, Droplet, Undo2, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '@/lib/db'
import { logWeight } from '@/data/weight'
import { deleteEntry, dayTotals, copyDay } from '@/data/log'
import { markPlannedEaten } from '@/data/planner'
import { addWater, undoWater } from '@/data/water'
import { getNote, setNote } from '@/data/notes'
import { getCurrentTarget } from '@/data/targets'
import { todayISO } from '@/lib/util'
import { SaveMealSheet } from '@/components/SaveMealSheet'
import { AiLogSheet } from '@/components/AiLogSheet'
import { EditEntrySheet } from '@/components/EditEntrySheet'
import { usePrefs } from '@/lib/prefs'
import { toKg, formatWeight, formatMass, formatVolume, flozToMl, weightUnitFor } from '@/lib/units'
import { MEAL_SLOTS } from '@/components/MealSlotSelect'
import { LogFoodSheet } from '@/components/LogFoodSheet'
import { QuickAddSheet } from '@/components/QuickAddSheet'
import { ProgressRing, MacroBar } from '@/components/ProgressRing'
import type { LogEntry, MealSlot, TargetRow } from '@/types/db'
import type { Nutrients } from '@/lib/nutrients'

const HISTORY_DAYS = 6 // how far back you can browse (today + 6 = 7 days)

function shiftDate(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function Today() {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [foodSheet, setFoodSheet] = useState<MealSlot | null>(null)
  const [quickSheet, setQuickSheet] = useState<MealSlot | null>(null)
  const [saveSlot, setSaveSlot] = useState<MealSlot | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<LogEntry | null>(null)

  const minDate = shiftDate(today, -HISTORY_DAYS)
  const isToday = date === today

  const entries =
    useLiveQuery(
      () => db.log_entries.where('date').equals(date).toArray(),
      [date],
      [] as LogEntry[],
    ).filter((e) => !e.deleted) ?? []

  const totals = dayTotals(entries)
  const target = useLiveQuery(() => getCurrentTarget(date), [date])

  return (
    <div className="space-y-6">
      <DayNav
        date={date}
        isToday={isToday}
        canPrev={date > minDate}
        onPrev={() => setDate((d) => shiftDate(d, -1))}
        onNext={() => setDate((d) => shiftDate(d, 1))}
        onToday={() => setDate(today)}
      />

      <DayDashboard
        totals={totals}
        target={target}
        isToday={isToday}
        onQuickAdd={() => setQuickSheet('snack')}
        onCopyYesterday={() => void copyDay(shiftDate(date, -1), date)}
        onAiLog={() => setAiOpen(true)}
      />

      {MEAL_SLOTS.map((slot) => {
        const slotLogged = entries.filter((e) => e.meal_slot === slot.value && e.source === 'logged')
        const slotPlanned = entries.filter((e) => e.meal_slot === slot.value && e.source === 'planned')
        const slotKcal = Math.round(dayTotals(slotLogged).energy ?? 0)
        return (
          <section key={slot.value}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {slot.label}
                {slotKcal > 0 && <span className="ml-2 text-xs text-muted">{slotKcal} kcal</span>}
              </h3>
              <div className="flex items-center gap-3">
                {slotLogged.length > 0 && (
                  <button
                    onClick={() => setSaveSlot(slot.value)}
                    aria-label={`Save ${slot.label} as a meal`}
                    className="text-muted hover:text-[var(--color-brand)]"
                  >
                    <BookmarkPlus size={16} />
                  </button>
                )}
                <button
                  onClick={() => setFoodSheet(slot.value)}
                  className="flex items-center gap-1 text-sm text-[var(--color-brand)]"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>
            {slotLogged.length === 0 && slotPlanned.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-3 text-xs text-muted">
                Nothing logged yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {slotLogged.length > 0 && (
                  <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
                    {slotLogged.map((e) => (
                      <EntryRow key={e.client_uuid} entry={e} onEdit={setEditEntry} />
                    ))}
                  </ul>
                )}
                {slotPlanned.length > 0 && (
                  <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-dashed border-[var(--color-border)]">
                    {slotPlanned.map((e) => (
                      <PlannedRow key={e.client_uuid} entry={e} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )
      })}

      <WaterCard date={date} />
      <NotesCard date={date} />
      <WeighInCard />

      <LogFoodSheet
        open={foodSheet !== null}
        onClose={() => setFoodSheet(null)}
        mealSlot={foodSheet ?? 'snack'}
        date={date}
      />
      <QuickAddSheet
        open={quickSheet !== null}
        onClose={() => setQuickSheet(null)}
        mealSlot={quickSheet ?? 'snack'}
        date={date}
      />
      <SaveMealSheet
        open={saveSlot !== null}
        onClose={() => setSaveSlot(null)}
        entries={entries.filter((e) => e.meal_slot === saveSlot && e.source === 'logged')}
        defaultName={saveSlot ? `My ${saveSlot}` : 'Saved meal'}
      />
      <AiLogSheet open={aiOpen} onClose={() => setAiOpen(false)} mealSlot="snack" date={date} />
      <EditEntrySheet entry={editEntry} onClose={() => setEditEntry(null)} />
    </div>
  )
}

function WaterCard({ date }: { date: string }) {
  const system = usePrefs((s) => s.system)
  const imperial = system === 'imperial'
  const total =
    useLiveQuery(
      async () => {
        const rows = await db.water_entries.where('date').equals(date).toArray()
        return rows.filter((w) => !w.deleted).reduce((s, w) => s + w.ml, 0)
      },
      [date],
      0,
    ) ?? 0
  const goal = 3000 // ml (~100 fl oz)
  // Increment buttons, in the active system (values stored as ml).
  const incs = imperial
    ? [{ label: '+8 oz', ml: flozToMl(8) }, { label: '+16 oz', ml: flozToMl(16) }]
    : [{ label: '+250 ml', ml: 250 }, { label: '+500 ml', ml: 500 }]

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Droplet size={15} className="text-[var(--color-fat)]" /> Water
        </h3>
        <span className="text-xs text-muted">
          {formatVolume(total, system)} / {formatVolume(goal, system)}
        </span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div className="h-full rounded-full bg-[var(--color-fat)]" style={{ width: `${Math.min(total / goal, 1) * 100}%` }} />
      </div>
      <div className="flex gap-2">
        {incs.map((inc) => (
          <button key={inc.label} onClick={() => void addWater(inc.ml, date)} className="flex-1 rounded-lg border border-[var(--color-border)] py-1.5 text-sm">
            {inc.label}
          </button>
        ))}
        <button onClick={() => void undoWater(date)} aria-label="Undo last water" className="rounded-lg border border-[var(--color-border)] px-3 text-muted">
          <Undo2 size={15} />
        </button>
      </div>
    </section>
  )
}

function NotesCard({ date }: { date: string }) {
  const [note, setNoteState] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    void getNote(date).then((n) => {
      setNoteState(n)
      setLoaded(true)
    })
  }, [date])
  // Debounced save.
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => void setNote(note, date), 600)
    return () => clearTimeout(t)
  }, [note, date, loaded])

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-2 text-sm font-medium">Notes</h3>
      <textarea
        value={note}
        onChange={(e) => setNoteState(e.target.value)}
        rows={2}
        placeholder="How did today feel? Cravings, energy, training…"
        className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
      />
    </section>
  )
}

function PlannedRow({ entry }: { entry: LogEntry }) {
  const system = usePrefs((s) => s.system)
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-muted">{entry.description}</p>
        <p className="truncate text-xs text-muted">
          planned · {entry.grams > 0 ? `${formatMass(entry.grams, system)} · ` : ''}
          {Math.round(entry.nutrients.energy ?? 0)} kcal
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => void markPlannedEaten(entry.client_uuid)}
          className="flex items-center gap-1 rounded-md bg-[var(--color-brand)] px-2 py-1 text-xs font-medium text-black"
        >
          <Check size={12} /> Ate it
        </button>
        <button
          onClick={() => void deleteEntry(entry.client_uuid)}
          aria-label={`Remove planned ${entry.description}`}
          className="text-muted hover:text-[var(--color-warn)]"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  )
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-muted hover:text-[var(--color-text)]"
    >
      {children}
    </button>
  )
}

function DayNav({
  date,
  isToday,
  canPrev,
  onPrev,
  onNext,
  onToday,
}: {
  date: string
  isToday: boolean
  canPrev: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  const label = isToday
    ? 'Today'
    : new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return (
    <div className="flex items-center justify-between">
      <button onClick={onPrev} disabled={!canPrev} aria-label="Previous day" className="rounded-lg p-1.5 text-muted disabled:opacity-25">
        <ChevronLeft size={20} />
      </button>
      <button onClick={onToday} className="text-base font-semibold" aria-label={isToday ? 'Today' : `${label} — tap for today`}>
        {label}
        {!isToday && <span className="ml-2 text-xs font-normal text-[var(--color-brand)]">→ Today</span>}
      </button>
      <button onClick={onNext} disabled={isToday} aria-label="Next day" className="rounded-lg p-1.5 text-muted disabled:opacity-25">
        <ChevronRight size={20} />
      </button>
    </div>
  )
}

function DayDashboard({
  totals,
  target,
  isToday,
  onQuickAdd,
  onCopyYesterday,
  onAiLog,
}: {
  totals: Nutrients
  target: TargetRow | undefined
  isToday: boolean
  onQuickAdd: () => void
  onCopyYesterday: () => void
  onAiLog: () => void
}) {
  const eaten = Math.round(totals.energy ?? 0)

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">{isToday ? 'Today' : 'Summary'}</h2>
        <div className="flex items-center gap-1.5">
          <IconBtn onClick={onAiLog} title="Describe a meal in words"><Sparkles size={14} /></IconBtn>
          <IconBtn onClick={onCopyYesterday} title="Copy the previous day's food into this day"><CopyPlus size={14} /></IconBtn>
          <IconBtn onClick={onQuickAdd} title="Quick add macros"><Zap size={14} /></IconBtn>
        </div>
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

function EntryRow({ entry, onEdit }: { entry: LogEntry; onEdit: (e: LogEntry) => void }) {
  const system = usePrefs((s) => s.system)
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <button onClick={() => onEdit(entry)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${entry.description}`}>
        <p className="truncate text-sm">{entry.description}</p>
        <p className="truncate text-xs text-muted">
          {entry.grams > 0 ? `${formatMass(entry.grams, system)} · ` : ''}
          {Math.round(entry.nutrients.protein ?? 0)}P · {Math.round(entry.nutrients.carbs ?? 0)}C ·{' '}
          {Math.round(entry.nutrients.fat ?? 0)}F
        </p>
      </button>
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
  const unit = weightUnitFor(usePrefs((s) => s.system))
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
