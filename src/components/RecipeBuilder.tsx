import { useEffect, useState } from 'react'
import { ChevronLeft, Search, Trash2, Loader2 } from 'lucide-react'
import { searchFoods } from '@/data/foodSource'
import { saveFoodFromResult } from '@/data/foods'
import { saveRecipe, recipePerServing } from '@/data/recipes'
import type { Recipe, RecipeIngredient } from '@/types/db'
import type { FoodResult } from '@/types/food'

// Build/edit a recipe: add ingredients (inline food search), set servings + steps,
// see live per-serving macros computed from the food database.
export function RecipeBuilder({
  initial,
  onSaved,
  onBack,
}: {
  initial?: Recipe
  onSaved: (r: Recipe) => void
  onBack: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [servings, setServings] = useState(String(initial?.servings ?? 1))
  const [steps, setSteps] = useState(initial?.steps ?? '')
  const [items, setItems] = useState<RecipeIngredient[]>(initial?.ingredients ?? [])
  const [saving, setSaving] = useState(false)

  const servingsNum = parseFloat(servings) || 1
  const perServing = recipePerServing(items, servingsNum)

  async function save() {
    if (!name.trim() || items.length === 0) return
    setSaving(true)
    const r = await saveRecipe({ id: initial?.id, name, servings: servingsNum, steps, ingredients: items })
    onSaved(r)
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeft size={16} /> Back
      </button>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Recipe name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={cls} placeholder="Overnight oats" />
      </label>

      <IngredientAdder onAdd={(ing) => setItems((p) => [...p, ing])} />

      {items.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {items.map((ing, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{ing.description}</span>
              <input
                type="number"
                inputMode="decimal"
                value={ing.grams}
                onChange={(e) =>
                  setItems((p) => p.map((x, j) => (j === i ? { ...x, grams: parseFloat(e.target.value) || 0 } : x)))
                }
                className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-sm"
                aria-label={`Grams of ${ing.description}`}
              />
              <span className="text-xs text-muted">g</span>
              <button onClick={() => setItems((p) => p.filter((_, j) => j !== i))} aria-label="Remove" className="text-muted hover:text-[var(--color-warn)]">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Servings</span>
          <input type="number" inputMode="decimal" min="1" value={servings} onChange={(e) => setServings(e.target.value)} className={cls} />
        </label>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-center">
          <div className="text-lg font-semibold tabular-nums">{Math.round(perServing.energy ?? 0)}</div>
          <div className="text-[11px] text-muted">kcal / serving</div>
        </div>
      </div>

      {items.length > 0 && (
        <p className="-mt-2 text-center text-xs text-muted">
          per serving: {Math.round(perServing.protein ?? 0)}P · {Math.round(perServing.carbs ?? 0)}C · {Math.round(perServing.fat ?? 0)}F
        </p>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Steps (optional)</span>
        <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} className={cls} placeholder="1. Combine…" />
      </label>

      <button
        onClick={save}
        disabled={saving || !name.trim() || items.length === 0}
        className="w-full rounded-lg bg-[var(--color-brand)] px-3 py-2.5 font-medium text-black disabled:opacity-60"
      >
        Save recipe
      </button>
    </div>
  )
}

function IngredientAdder({ onAdd }: { onAdd: (ing: RecipeIngredient) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        setResults(await searchFoods(q, 8))
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  async function pick(r: FoodResult) {
    const food = await saveFoodFromResult(r)
    onAdd({ food_id: food.id, description: food.name, grams: 100, nutrients_per_100g: food.nutrients })
    setQuery('')
    setResults([])
  }

  return (
    <div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add an ingredient…"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)]"
        />
        {loading && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />}
      </div>
      {results.length > 0 && (
        <ul className="mt-1 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
          {results.map((r) => (
            <li key={`${r.source}:${r.source_id}`}>
              <button onClick={() => pick(r)} className="w-full px-3 py-2 text-left text-sm">
                {r.name}
                {r.brand && <span className="text-xs text-muted"> · {r.brand}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const cls =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]'
