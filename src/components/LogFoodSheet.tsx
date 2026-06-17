import { useState } from 'react'
import { Modal } from './Modal'
import { FoodSearch } from './FoodSearch'
import { ServingPicker } from './ServingPicker'
import { CustomFoodForm } from './CustomFoodForm'
import { RecipeBuilder } from './RecipeBuilder'
import { RecipeServingPicker } from './RecipeServingPicker'
import { logMeal } from '@/data/meals'
import type { Food, Meal, Recipe, MealSlot } from '@/types/db'

type Stage =
  | { name: 'search' }
  | { name: 'custom' }
  | { name: 'serving'; food: Food }
  | { name: 'recipeBuilder' }
  | { name: 'recipeServings'; recipe: Recipe }

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

  const title =
    stage.name === 'serving'
      ? 'Add serving'
      : stage.name === 'custom'
        ? 'Custom food'
        : stage.name === 'recipeBuilder'
          ? 'New recipe'
          : stage.name === 'recipeServings'
            ? 'Add recipe'
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
        />
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
