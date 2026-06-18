import { useState } from 'react'
import { Modal } from './Modal'
import { MealSlotSelect } from './MealSlotSelect'
import { quickAddMacros, updateEntry } from '@/data/log'
import type { LogEntry, MealSlot } from '@/types/db'

// Log raw macros without finding an exact food. With `existing`, edits that entry.
export function QuickAddSheet({
  open,
  onClose,
  mealSlot,
  date,
  existing,
}: {
  open: boolean
  onClose: () => void
  mealSlot: MealSlot
  date: string
  existing?: LogEntry
}) {
  const [description, setDescription] = useState(existing?.description ?? '')
  const [energy, setEnergy] = useState(existing ? String(Math.round(existing.nutrients.energy ?? 0)) : '')
  const [protein, setProtein] = useState(existing ? String(Math.round(existing.nutrients.protein ?? 0)) : '')
  const [carbs, setCarbs] = useState(existing ? String(Math.round(existing.nutrients.carbs ?? 0)) : '')
  const [fat, setFat] = useState(existing ? String(Math.round(existing.nutrients.fat ?? 0)) : '')
  const [slot, setSlot] = useState<MealSlot>(existing?.meal_slot ?? mealSlot)
  const [saving, setSaving] = useState(false)

  const num = (s: string) => parseFloat(s) || 0

  function reset() {
    setDescription('')
    setEnergy('')
    setProtein('')
    setCarbs('')
    setFat('')
    setSaving(false)
  }

  async function save() {
    setSaving(true)
    if (existing) {
      await updateEntry({
        ...existing,
        description: description.trim() || existing.description,
        meal_slot: slot,
        nutrients: { ...existing.nutrients, energy: num(energy), protein: num(protein), carbs: num(carbs), fat: num(fat) },
      })
    } else {
      await quickAddMacros({
        description,
        energy: num(energy),
        protein: num(protein),
        carbs: num(carbs),
        fat: num(fat),
        mealSlot: slot,
        date,
      })
    }
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit entry' : 'Quick add'}>
      <div className="space-y-4">
        <Field label="Description">
          <input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
            placeholder="Protein shake"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories (kcal)">
            <input type="number" inputMode="decimal" value={energy} onChange={(e) => setEnergy(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Protein (g)">
            <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Carbs (g)">
            <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Fat (g)">
            <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Meal">
          <MealSlotSelect value={slot} onChange={setSlot} />
        </Field>
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-lg bg-[var(--color-brand)] px-3 py-2.5 font-medium text-black disabled:opacity-60"
        >
          {existing ? 'Save changes' : 'Add'}
        </button>
      </div>
    </Modal>
  )
}

const inputCls =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  )
}
