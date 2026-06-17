import { useState, lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from './Modal'
import { FoodSearch } from './FoodSearch'
import { ServingPicker } from './ServingPicker'
import { CustomFoodForm } from './CustomFoodForm'
import { RecipeBuilder } from './RecipeBuilder'
import { RecipeServingPicker } from './RecipeServingPicker'
import { logMeal } from '@/data/meals'

// Defer the ZXing barcode library until the user actually scans.
const BarcodeScanner = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })))
import { lookupBarcode } from '@/data/foodSource'
import { saveFoodFromResult } from '@/data/foods'
import type { Food, Meal, Recipe, MealSlot } from '@/types/db'

type Stage =
  | { name: 'search' }
  | { name: 'custom' }
  | { name: 'serving'; food: Food }
  | { name: 'recipeBuilder' }
  | { name: 'recipeServings'; recipe: Recipe }
  | { name: 'scan' }
  | { name: 'scanLookup' }
  | { name: 'scanNotFound'; code: string }

// Orchestrates the full add-food flow: search/recents → (custom) → serving picker.
export function LogFoodSheet({
  open,
  onClose,
  mealSlot,
  date,
}: {
  open: boolean
  onClose: () => void
  mealSlot: MealSlot
  date: string
}) {
  const [stage, setStage] = useState<Stage>({ name: 'search' })

  function close() {
    setStage({ name: 'search' })
    onClose()
  }

  async function logSavedMeal(meal: Meal) {
    await logMeal(meal, mealSlot, date)
    close()
  }

  async function handleBarcode(code: string) {
    setStage({ name: 'scanLookup' })
    try {
      const result = await lookupBarcode(code)
      if (result) {
        const food = await saveFoodFromResult(result)
        setStage({ name: 'serving', food })
      } else {
        setStage({ name: 'scanNotFound', code })
      }
    } catch {
      setStage({ name: 'scanNotFound', code })
    }
  }

  const title =
    stage.name === 'serving'
      ? 'Add serving'
      : stage.name === 'custom'
        ? 'Custom food'
        : stage.name === 'recipeBuilder'
          ? 'New recipe'
          : stage.name === 'recipeServings'
            ? 'Add recipe'
            : stage.name === 'scan' || stage.name === 'scanLookup' || stage.name === 'scanNotFound'
              ? 'Scan barcode'
              : 'Add food'

  return (
    <Modal open={open} onClose={close} title={title}>
      {stage.name === 'search' && (
        <FoodSearch
          onPick={(food) => setStage({ name: 'serving', food })}
          onLogMeal={logSavedMeal}
          onLogRecipe={(recipe) => setStage({ name: 'recipeServings', recipe })}
          onCreateRecipe={() => setStage({ name: 'recipeBuilder' })}
          onCustom={() => setStage({ name: 'custom' })}
          onScan={() => setStage({ name: 'scan' })}
        />
      )}
      {stage.name === 'scan' && (
        <Suspense fallback={<div className="py-10 text-center text-muted"><Loader2 size={22} className="mx-auto animate-spin" /></div>}>
          <BarcodeScanner onDetected={handleBarcode} onBack={() => setStage({ name: 'search' })} />
        </Suspense>
      )}
      {stage.name === 'scanLookup' && (
        <div className="flex flex-col items-center gap-3 py-10 text-muted">
          <Loader2 size={24} className="animate-spin" />
          <p className="text-sm">Looking up product…</p>
        </div>
      )}
      {stage.name === 'scanNotFound' && (
        <div className="space-y-4 py-6 text-center">
          <p className="text-sm text-muted">
            No product found for barcode <span className="font-mono">{stage.code}</span>.
          </p>
          <div className="flex justify-center gap-2">
            <button onClick={() => setStage({ name: 'scan' })} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">
              Scan again
            </button>
            <button onClick={() => setStage({ name: 'search' })} className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-black">
              Search instead
            </button>
          </div>
        </div>
      )}
      {stage.name === 'custom' && (
        <CustomFoodForm
          onCreated={(food) => setStage({ name: 'serving', food })}
          onBack={() => setStage({ name: 'search' })}
        />
      )}
      {stage.name === 'serving' && (
        <ServingPicker
          food={stage.food}
          mealSlot={mealSlot}
          date={date}
          onLogged={close}
          onBack={() => setStage({ name: 'search' })}
        />
      )}
      {stage.name === 'recipeBuilder' && (
        <RecipeBuilder
          onSaved={(recipe) => setStage({ name: 'recipeServings', recipe })}
          onBack={() => setStage({ name: 'search' })}
        />
      )}
      {stage.name === 'recipeServings' && (
        <RecipeServingPicker
          recipe={stage.recipe}
          mealSlot={mealSlot}
          date={date}
          onLogged={close}
          onBack={() => setStage({ name: 'search' })}
        />
      )}
    </Modal>
  )
}
