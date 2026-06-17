import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wand2, Lock, LockOpen, RefreshCw, Check, Loader2 } from 'lucide-react'
import { generatePlan, savePlannedDay, type GeneratedPlan } from '@/data/planner'
import { planTotals, type PlannedItem } from '@/lib/planner'
import { MEAL_SLOTS } from '@/components/MealSlotSelect'
import { MacroBar } from '@/components/ProgressRing'
import { GroceryList } from '@/components/GroceryList'
import { todayISO } from '@/lib/util'
import type { MealSlot } from '@/types/db'

export function Plan() {
  const date = todayISO()
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [seed, setSeed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function generate(lockedKeep: PlannedItem[] = [], nextSeed = seed) {
    setBusy(true)
    setSaved(false)
    const g = await generatePlan(date, { locked: lockedKeep, seed: nextSeed })
    setPlan(g)
    setBusy(false)
  }

  function toggleLock(idx: number) {
    setPlan((p) => {
      if (!p) return p
      const items = p.items.map((it, i) => (i === idx ? { ...it, locked: !it.locked } : it))
      return { ...p, items, totals: planTotals(items) }
    })
  }

  async function regenerate() {
    if (!plan) return
    const next = seed + 1
    setSeed(next)
    await generate(plan.items.filter((it) => it.locked), next)
  }

  async function swapSlot(slot: MealSlot) {
    if (!plan) return
    const next = seed + 1
    setSeed(next)
    // Keep every other slot; only this slot's items get re-picked.
    await generate(plan.items.filter((it) => it.slot !== slot), next)
  }

  async function useThisPlan() {
    if (!plan) return
    setBusy(true)
    await savePlannedDay(date, plan.items)
    setSaved(true)
    setBusy(false)
  }

  if (plan && plan.target === null) {
    return <NeedGoals />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Plan</h2>
        {plan && (
          <button onClick={regenerate} disabled={busy} className="flex items-center gap-1 text-sm text-muted">
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Regenerate
          </button>
        )}
      </div>

      {!plan ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center">
          <p className="mb-4 text-sm text-muted">Auto-generate a day of meals that hits your calorie + macro targets.</p>
          <button
            onClick={() => generate()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 py-2.5 font-medium text-black disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Generate a plan
          </button>
        </div>
      ) : (
        <>
          {plan.target && (
            <section className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">Plan total</span>
                <span className="text-sm tabular-nums">
                  {plan.totals.energy} / {plan.target.energy} kcal
                </span>
              </div>
              <MacroBar label="Protein" value={plan.totals.protein} target={plan.target.protein} color="var(--color-protein)" />
              <MacroBar label="Carbs" value={plan.totals.carbs} target={plan.target.carbs} color="var(--color-carbs)" />
              <MacroBar label="Fat" value={plan.totals.fat} target={plan.target.fat} color="var(--color-fat)" />
            </section>
          )}

          {MEAL_SLOTS.map((s) => {
            const items = plan.items.filter((it) => it.slot === s.value)
            if (!items.length) return null
            const kcal = Math.round(items.reduce((sum, it) => sum + (it.nutrients.energy ?? 0), 0))
            return (
              <section key={s.value}>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    {s.label} <span className="ml-1 text-xs text-muted">{kcal} kcal</span>
                  </h3>
                  <button onClick={() => swapSlot(s.value)} className="text-xs text-[var(--color-brand)]">
                    Swap
                  </button>
                </div>
                <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
                  {plan.items.map((it, i) =>
                    it.slot === s.value ? (
                      <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{it.name}</p>
                          <p className="text-xs text-muted">
                            {it.grams} g · {Math.round(it.nutrients.energy ?? 0)} kcal ·{' '}
                            {Math.round(it.nutrients.protein ?? 0)}P
                          </p>
                        </div>
                        <button
                          onClick={() => toggleLock(i)}
                          aria-label={it.locked ? 'Unlock' : 'Lock'}
                          className={it.locked ? 'text-[var(--color-brand)]' : 'text-muted'}
                        >
                          {it.locked ? <Lock size={15} /> : <LockOpen size={15} />}
                        </button>
                      </li>
                    ) : null,
                  )}
                </ul>
              </section>
            )
          })}

          <button
            onClick={useThisPlan}
            disabled={busy || saved}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] px-3 py-2.5 font-medium text-black disabled:opacity-60"
          >
            {saved ? <Check size={16} /> : null}
            {saved ? 'Added to today' : 'Pre-log this plan to today'}
          </button>
          <p className="text-center text-xs text-muted">
            Lock 🔒 meals you like, then Regenerate or Swap. Pre-logged meals show on Today as planned —
            tap “Ate it” to confirm.
          </p>

          <GroceryList date={date} />
        </>
      )}
    </div>
  )
}

function NeedGoals() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Plan</h2>
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-muted">
        Set your goals first — the planner builds a day to your calorie + macro targets.
        <div className="mt-3">
          <Link to="/settings" className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-black">
            Set goals →
          </Link>
        </div>
      </div>
    </div>
  )
}
