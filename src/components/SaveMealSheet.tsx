import { useState } from 'react'
import { Modal } from './Modal'
import { createMealFromEntries } from '@/data/meals'
import { createComboFood } from '@/data/foods'
import type { LogEntry } from '@/types/db'

// Save a meal slot's logged entries either as a one-tap MEAL (logs each item
// separately) or as a single combined FOOD in your library (e.g. coffee + half &
// half + sugar → "My Coffee", logged as one line, searchable + favoritable).
export function SaveMealSheet({
  open,
  onClose,
  entries,
  defaultName,
}: {
  open: boolean
  onClose: () => void
  entries: LogEntry[]
  defaultName: string
}) {
  const [name, setName] = useState(defaultName)
  const [mode, setMode] = useState<'meal' | 'food'>('meal')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || !entries.length) return
    setSaving(true)
    if (mode === 'food') {
      await createComboFood(name, entries.map((e) => ({ nutrients: e.nutrients, grams: e.grams })))
    } else {
      await createMealFromEntries(name, entries)
    }
    setSaving(false)
    onClose()
  }

  const totalKcal = Math.round(entries.reduce((s, e) => s + (e.nutrients.energy ?? 0), 0))

  return (
    <Modal open={open} onClose={onClose} title="Save these foods">
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Save as" className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'meal', title: 'As a meal', sub: 'Logs each item separately' },
              { value: 'food', title: 'As one food', sub: 'Combined into one library item' },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={mode === o.value}
              onClick={() => setMode(o.value)}
              className={`rounded-lg border p-3 text-left text-sm ${
                mode === o.value
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10'
                  : 'border-[var(--color-border)]'
              }`}
            >
              <div className="font-medium">{o.title}</div>
              <div className="text-xs text-muted">{o.sub}</div>
            </button>
          ))}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === 'food' ? 'e.g. My coffee' : 'e.g. Usual breakfast'}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          />
        </label>

        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] text-sm">
          {entries.map((e) => (
            <li key={e.client_uuid} className="flex justify-between px-3 py-2">
              <span className="truncate">{e.description}</span>
              <span className="shrink-0 text-muted">{Math.round(e.nutrients.energy ?? 0)} kcal</span>
            </li>
          ))}
        </ul>

        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="w-full rounded-lg bg-[var(--color-brand)] px-3 py-2.5 font-medium text-black disabled:opacity-60"
        >
          {mode === 'food'
            ? `Save as food (${totalKcal} kcal)`
            : `Save meal (${entries.length} item${entries.length === 1 ? '' : 's'})`}
        </button>
      </div>
    </Modal>
  )
}
