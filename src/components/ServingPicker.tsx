import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { logFood } from '@/data/log'
import { scaleNutrients } from '@/lib/nutrients'
import { MEAL_SLOTS, MealSlotSelect } from './MealSlotSelect'
import type { Food, MealSlot } from '@/types/db'

// Stage 2 of logging: choose serving + quantity, see resolved macros, log it.
export function ServingPicker({
  food,
  mealSlot,
  date,
  onLogged,
  onBack,
}: {
  food: Food
  mealSlot: MealSlot
  date: string
  onLogged: () => void
  onBack: () => void
}) {
  const servings = food.servings.length ? food.servings : [{ label: '100 g', grams: 100 }]
  const [idx, setIdx] = useState(Math.min(food.default_serving, servings.length - 1))
  const [qty, setQty] = useState('1')
  const [slot, setSlot] = useState<MealSlot>(mealSlot)
  const [saving, setSaving] = useState(false)

  const quantity = parseFloat(qty) || 0
  const grams = servings[idx].grams * quantity
  const n = scaleNutrients(food.nutrients, grams)

  async function add() {
    if (grams <= 0) return
    setSaving(true)
    await logFood({ food, grams, mealSlot: slot, date, unitLabel: servings[idx].label, quantity })
    onLogged()
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeft size={16} /> Back to search
      </button>

      <div>
        <p className="font-medium">{food.name}</p>
        {food.brand && <p className="text-xs text-muted">{food.brand}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Quantity</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Serving</span>
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          >
            {servings.map((s, i) => (
              <option key={i} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Meal</span>
        <MealSlotSelect value={slot} onChange={setSlot} />
      </label>

      <div className="grid grid-cols-4 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
        <Stat label="kcal" value={Math.round(n.energy ?? 0)} tone="text-[var(--color-text)]" />
        <Stat label="P" value={Math.round(n.protein ?? 0)} tone="text-[var(--color-protein)]" />
        <Stat label="C" value={Math.round(n.carbs ?? 0)} tone="text-[var(--color-carbs)]" />
        <Stat label="F" value={Math.round(n.fat ?? 0)} tone="text-[var(--color-fat)]" />
      </div>
      <p className="-mt-2 text-center text-xs text-muted">{Math.round(grams)} g total</p>

      <button
        onClick={add}
        disabled={saving || grams <= 0}
        className="w-full rounded-lg bg-[var(--color-brand)] px-3 py-2.5 font-medium text-black disabled:opacity-60"
      >
        Add to {MEAL_SLOTS.find((s) => s.value === slot)?.label}
      </button>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className={`text-lg font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
