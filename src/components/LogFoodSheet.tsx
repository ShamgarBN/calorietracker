import { useState } from 'react'
import { Modal } from './Modal'
import { FoodSearch } from './FoodSearch'
import { ServingPicker } from './ServingPicker'
import { CustomFoodForm } from './CustomFoodForm'
import type { Food, MealSlot } from '@/types/db'

type Stage = { name: 'search' } | { name: 'custom' } | { name: 'serving'; food: Food }

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

  const title =
    stage.name === 'serving' ? 'Add serving' : stage.name === 'custom' ? 'Custom food' : 'Add food'

  return (
    <Modal open={open} onClose={close} title={title}>
      {stage.name === 'search' && (
        <FoodSearch
          onPick={(food) => setStage({ name: 'serving', food })}
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
    </Modal>
  )
}
