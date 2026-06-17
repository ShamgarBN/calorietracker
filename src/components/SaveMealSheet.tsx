import { useState } from 'react'
import { Modal } from './Modal'
import { createMealFromEntries } from '@/data/meals'
import type { LogEntry } from '@/types/db'

// Bundle a meal slot's logged entries into a reusable one-tap saved meal.
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
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || !entries.length) return
    setSaving(true)
    await createMealFromEntries(name, entries)
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Save as meal">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Meal name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Usual breakfast"
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
          Save meal ({entries.length} item{entries.length === 1 ? '' : 's'})
        </button>
      </div>
    </Modal>
  )
}
