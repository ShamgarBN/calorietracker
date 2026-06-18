import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { ServingPicker } from './ServingPicker'
import { QuickAddSheet } from './QuickAddSheet'
import { db } from '@/lib/db'
import type { Food, LogEntry } from '@/types/db'

// Edit a logged entry. Food entries reuse the serving picker (change serving/amount/
// meal); quick-adds and recipe entries use the macro editor.
export function EditEntrySheet({ entry, onClose }: { entry: LogEntry | null; onClose: () => void }) {
  const [food, setFood] = useState<Food | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    setLoaded(false)
    setFood(null)
    if (entry?.food_id) {
      void db.foods.get(entry.food_id).then((f) => {
        if (!active) return
        setFood(f ?? null)
        setLoaded(true)
      })
    } else {
      setLoaded(true)
    }
    return () => {
      active = false
    }
  }, [entry])

  if (!entry) return null

  // Food entry with the food still in cache → serving editor.
  if (entry.food_id && food) {
    return (
      <Modal open onClose={onClose} title="Edit entry">
        <ServingPicker
          key={entry.client_uuid}
          food={food}
          mealSlot={entry.meal_slot}
          date={entry.date}
          existing={entry}
          onLogged={onClose}
          onBack={onClose}
        />
      </Modal>
    )
  }

  // Quick-add / recipe / food-not-cached → edit macros directly.
  if (loaded) {
    return <QuickAddSheet key={entry.client_uuid} open onClose={onClose} mealSlot={entry.meal_slot} date={entry.date} existing={entry} />
  }
  return null
}
