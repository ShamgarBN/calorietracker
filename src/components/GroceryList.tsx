import { useLiveQuery } from 'dexie-react-hooks'
import { ShoppingCart } from 'lucide-react'
import { db } from '@/lib/db'
import { buildGroceryList, addPantry, removePantry } from '@/data/grocery'
import { usePrefs } from '@/lib/prefs'
import { formatMass } from '@/lib/units'

// Pantry-aware, aisle-sorted grocery list from the day's planned meals. Check an
// item to mark it as "have" (saved to your local pantry) so it greys out.
export function GroceryList({ date }: { date: string }) {
  const system = usePrefs((s) => s.system)
  // Re-runs when planned entries OR the pantry change.
  const aisles = useLiveQuery(async () => {
    await db.pantry.count() // touch pantry table so liveQuery tracks it
    await db.log_entries.where('date').equals(date).count()
    return buildGroceryList(date)
  }, [date])

  if (!aisles || aisles.length === 0) return null

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted">
        <ShoppingCart size={14} /> Grocery list
      </h3>
      <div className="space-y-3">
        {aisles.map((a) => (
          <div key={a.aisle}>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-brand)]">{a.aisle}</h4>
            <ul className="space-y-1">
              {a.items.map((it) => (
                <li key={it.name}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={it.have}
                      onChange={(e) => (e.target.checked ? addPantry(it.name) : removePantry(it.name))}
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                    <span className={it.have ? 'text-muted line-through' : ''}>{it.name}</span>
                    <span className="ml-auto text-xs text-muted">{formatMass(it.grams, system)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Checked items are saved to your pantry and subtracted next time.</p>
    </section>
  )
}
