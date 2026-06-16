import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { createCustomFood } from '@/data/foods'
import type { Food, Serving } from '@/types/db'

// Create a user-defined food. Macros are entered per 100 g (the storage base);
// an optional serving size adds a convenient portion.
export function CustomFoodForm({
  onCreated,
  onBack,
}: {
  onCreated: (f: Food) => void
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [energy, setEnergy] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [servingG, setServingG] = useState('')
  const [saving, setSaving] = useState(false)

  const num = (s: string) => parseFloat(s) || 0
  const canSave = name.trim().length > 0

  async function save() {
    if (!canSave) return
    setSaving(true)
    const sg = parseFloat(servingG)
    const servings: Serving[] | undefined =
      Number.isFinite(sg) && sg > 0
        ? [
            { label: '100 g', grams: 100 },
            { label: `1 serving (${sg} g)`, grams: sg },
          ]
        : undefined
    const food = await createCustomFood({
      name,
      brand,
      nutrients: { energy: num(energy), protein: num(protein), carbs: num(carbs), fat: num(fat) },
      servings,
    })
    onCreated(food)
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted">
        <ChevronLeft size={16} /> Back
      </button>

      <Field label="Name">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          placeholder="Homemade granola"
        />
      </Field>
      <Field label="Brand (optional)">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} />
      </Field>

      <p className="text-xs text-muted">Nutrition per 100 g:</p>
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
      <Field label="Serving size in grams (optional)">
        <input type="number" inputMode="decimal" value={servingG} onChange={(e) => setServingG(e.target.value)} className={inputCls} placeholder="e.g. 50" />
      </Field>

      <button
        onClick={save}
        disabled={!canSave || saving}
        className="w-full rounded-lg bg-[var(--color-brand)] px-3 py-2.5 font-medium text-black disabled:opacity-60"
      >
        Save & choose serving
      </button>
    </div>
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
