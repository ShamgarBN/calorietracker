import { useState } from 'react'
import { Sparkles, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { Modal } from './Modal'
import { MealSlotSelect } from './MealSlotSelect'
import { parseMeal, type ParsedDraft } from '@/data/aiLog'
import { logFood } from '@/data/log'
import { scaleNutrients } from '@/lib/nutrients'
import type { MealSlot } from '@/types/db'

// Natural-language logging: type a meal, AI parses it into items matched to the
// food DB, you review/adjust, then log. Confirm-before-log keeps you in control.
export function AiLogSheet({
  open,
  onClose,
  mealSlot,
  date,
}: {
  open: boolean
  onClose: () => void
  mealSlot: MealSlot
  date: string
}) {
  const [text, setText] = useState('')
  const [drafts, setDrafts] = useState<ParsedDraft[] | null>(null)
  const [slot, setSlot] = useState<MealSlot>(mealSlot)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setText('')
    setDrafts(null)
    setBusy(false)
    setError(null)
  }
  function close() {
    reset()
    onClose()
  }

  async function parse() {
    if (text.trim().length < 2) return
    setBusy(true)
    setError(null)
    try {
      setDrafts(await parseMeal(text))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse that')
    } finally {
      setBusy(false)
    }
  }

  function setGrams(i: number, grams: number) {
    setDrafts((d) => d && d.map((x, j) => (j === i ? { ...x, grams } : x)))
  }
  function remove(i: number) {
    setDrafts((d) => d && d.filter((_, j) => j !== i))
  }

  async function logAll() {
    if (!drafts) return
    setBusy(true)
    for (const d of drafts) {
      if (d.food && d.grams > 0) await logFood({ food: d.food, grams: d.grams, mealSlot: slot, date })
    }
    close()
  }

  const loggable = drafts?.filter((d) => d.food && d.grams > 0).length ?? 0

  return (
    <Modal open={open} onClose={close} title="Describe a meal">
      {!drafts ? (
        <div className="space-y-3">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="e.g. 2 eggs, a cup of oats with milk, and a banana"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          />
          {error && <p className="text-sm text-[var(--color-warn)]">{error}</p>}
          <button
            onClick={parse}
            disabled={busy || text.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] px-3 py-2.5 font-medium text-black disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {busy ? 'Parsing…' : 'Parse'}
          </button>
          <p className="text-center text-xs text-muted">You’ll review everything before it’s logged.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing recognized. Try rephrasing.</p>}
          <ul className="space-y-2">
            {drafts.map((d, i) => {
              const kcal = d.food ? Math.round(scaleNutrients(d.food.nutrients, d.grams).energy ?? 0) : 0
              return (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {d.food ? d.food.name : d.query}
                      {!d.food && <AlertCircle size={13} className="ml-1 inline text-[var(--color-warn)]" />}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {d.note ? `“${d.note}” · ` : ''}
                      {d.food ? `${kcal} kcal` : 'no match — skipped'}
                    </p>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={d.grams}
                    onChange={(e) => setGrams(i, parseFloat(e.target.value) || 0)}
                    aria-label={`Grams of ${d.food?.name ?? d.query}`}
                    className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-sm"
                  />
                  <span className="text-xs text-muted">g</span>
                  <button onClick={() => remove(i)} aria-label="Remove" className="text-muted hover:text-[var(--color-warn)]">
                    <Trash2 size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Meal</span>
            <MealSlotSelect value={slot} onChange={setSlot} />
          </label>
          <div className="flex gap-2">
            <button onClick={() => setDrafts(null)} className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm">
              Back
            </button>
            <button
              onClick={logAll}
              disabled={busy || loggable === 0}
              className="flex-1 rounded-lg bg-[var(--color-brand)] px-3 py-2.5 text-sm font-medium text-black disabled:opacity-60"
            >
              Log {loggable} item{loggable === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
