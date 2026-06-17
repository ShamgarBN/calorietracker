import { useEffect, useState } from 'react'
import { Search, Star, Plus, Loader2, Utensils, ChefHat, Trash2 } from 'lucide-react'
import { searchFoods } from '@/data/foodSource'
import { saveFoodFromResult, getRecentFoods, getFavoriteFoods, toggleFavorite } from '@/data/foods'
import { getMeals, deleteMeal } from '@/data/meals'
import { getRecipes } from '@/data/recipes'
import type { Food, Meal, Recipe } from '@/types/db'
import type { FoodResult } from '@/types/food'

// Stage 1 of logging: search the combined DB, or pick from saved meals / recipes / recents / favorites.
export function FoodSearch({
  onPick,
  onLogMeal,
  onLogRecipe,
  onCreateRecipe,
  onCustom,
}: {
  onPick: (food: Food) => void
  onLogMeal: (meal: Meal) => void
  onLogRecipe: (recipe: Recipe) => void
  onCreateRecipe: () => void
  onCustom: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [recents, setRecents] = useState<Food[]>([])
  const [favorites, setFavorites] = useState<Food[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getRecentFoods().then(setRecents)
    void getFavoriteFoods().then(setFavorites)
    void getMeals().then(setMeals)
    void getRecipes().then(setRecipes)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const t = setTimeout(async () => {
      try {
        setResults(await searchFoods(q))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  async function pickResult(r: FoodResult) {
    onPick(await saveFoodFromResult(r))
  }

  const showLists = query.trim().length < 2

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods (e.g. chicken breast)"
          aria-label="Search foods"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-3 outline-none focus:border-[var(--color-brand)]"
        />
        {loading && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCustom}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-muted hover:text-[var(--color-text)]"
        >
          <Plus size={16} /> Custom food
        </button>
        <button
          onClick={onCreateRecipe}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-muted hover:text-[var(--color-text)]"
        >
          <Plus size={16} /> Recipe
        </button>
      </div>

      {error && <p className="text-sm text-[var(--color-warn)]">{error}</p>}

      {showLists ? (
        <>
          {meals.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Saved meals</h3>
              <ul className="divide-y divide-[var(--color-border)]">
                {meals.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <button onClick={() => onLogMeal(m)} className="flex flex-1 items-center gap-2 py-2.5 text-left">
                      <Utensils size={15} className="shrink-0 text-[var(--color-brand)]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{m.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {m.items.length} item{m.items.length === 1 ? '' : 's'} ·{' '}
                          {Math.round(m.items.reduce((s, it) => s + (it.nutrients.energy ?? 0), 0))} kcal
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={async () => {
                        await deleteMeal(m.id)
                        setMeals(await getMeals())
                      }}
                      aria-label={`Delete ${m.name}`}
                      className="text-muted hover:text-[var(--color-warn)]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recipes.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Recipes</h3>
              <ul className="divide-y divide-[var(--color-border)]">
                {recipes.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => onLogRecipe(r)} className="flex w-full items-center gap-2 py-2.5 text-left">
                      <ChefHat size={15} className="shrink-0 text-[var(--color-brand)]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{r.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {Math.round(r.nutrients_per_serving.energy ?? 0)} kcal/serving · {r.servings} servings
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <FoodList title="Favorites" foods={favorites} onPick={onPick} onStar={refreshAfterStar} />
          <FoodList title="Recent" foods={recents} onPick={onPick} onStar={refreshAfterStar} />
          {favorites.length === 0 && recents.length === 0 && meals.length === 0 && recipes.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">
              Search above to log your first food.
            </p>
          )}
        </>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {results.map((r) => (
            <li key={`${r.source}:${r.source_id}`}>
              <button
                onClick={() => pickResult(r)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.is_generic ? 'Generic' : (r.brand ?? 'Branded')}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {Math.round(r.nutrients.energy ?? 0)} kcal/100g
                </span>
              </button>
            </li>
          ))}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <li className="py-6 text-center text-sm text-muted">No matches found.</li>
          )}
        </ul>
      )}
    </div>
  )

  async function refreshAfterStar(foodId: string) {
    await toggleFavorite(foodId)
    setFavorites(await getFavoriteFoods())
    setRecents(await getRecentFoods())
  }
}

function FoodList({
  title,
  foods,
  onPick,
  onStar,
}: {
  title: string
  foods: Food[]
  onPick: (f: Food) => void
  onStar: (id: string) => void
}) {
  if (foods.length === 0) return null
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
      <ul className="divide-y divide-[var(--color-border)]">
        {foods.map((f) => (
          <li key={f.id} className="flex items-center gap-2">
            <button onClick={() => onPick(f)} className="flex-1 py-2.5 text-left">
              <span className="block truncate text-sm">{f.name}</span>
              <span className="block truncate text-xs text-muted">
                {f.brand ?? (f.is_generic ? 'Generic' : 'Custom')} ·{' '}
                {Math.round(f.nutrients.energy ?? 0)} kcal/100g
              </span>
            </button>
            <button
              onClick={() => onStar(f.id)}
              aria-label={f.favorite ? 'Unfavorite' : 'Favorite'}
              className={f.favorite ? 'text-[var(--color-carbs)]' : 'text-muted'}
            >
              <Star size={16} fill={f.favorite ? 'currentColor' : 'none'} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
