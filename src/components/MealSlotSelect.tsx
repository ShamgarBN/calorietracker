import type { MealSlot } from '@/types/db'

export const MEAL_SLOTS: { value: MealSlot; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

export function MealSlotSelect({
  value,
  onChange,
}: {
  value: MealSlot
  onChange: (v: MealSlot) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as MealSlot)}
      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
    >
      {MEAL_SLOTS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  )
}
