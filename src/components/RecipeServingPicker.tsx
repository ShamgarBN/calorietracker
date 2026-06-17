import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { logRecipe } from '@/data/recipes'
import { MEAL_SLOTS, MealSlotSelect } from './MealSlotSelect'
import type { Recipe, MealSlot } from '@/types/db'

// Log N servings of a recipe.
export function RecipeServingPicker({
  recipe,
  mealSlot,
  date,
  onLogged,
  onBack,
}: {
  recipe: Recipe
  mealSlot: MealSlot
  date: string
  onLogged: () => void
  onBack: () => void
}) {
  const [servings, setServings] = useState('1')
  const [slot, setSlot] = useState<MealSlot>(mealSlot)
  const [saving, setSaving] = useState(false)

  const n = parseFloat(servings) || 0
  const per = recipe.nutrients_per_serving
  const scaled = (k: keyof typeof per) => Math.round((per[k] ?? 0) * n)

  async function add() {
    if (n <= 0) return
    setSaving(true)
    await logRecipe(recipe, n, slot, date)
    onLogged()
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeft size={16} /> Back
      </button>
      <p className="font-medium">{recipe.name}</p>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Servings</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Meal</span>
          <MealSlotSelect value={slot} onChange={setSlot} />
        </label>
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center">
        <Stat label="kcal" value={scaled('energy')} tone="text-[var(--color-text)]" />
        <Stat label="P" value={scaled('protein')} tone="text-[var(--color-protein)]" />
        <Stat label="C" value={scaled('carbs')} tone="text-[var(--color-carbs)]" />
        <Stat label="F" value={scaled('fat')} tone="text-[var(--color-fat)]" />
      </div>

      <button
        onClick={add}
        disabled={saving || n <= 0}
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
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
