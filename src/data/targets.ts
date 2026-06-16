import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { currentUserId } from '@/lib/supabase'
import { uuid, todayISO } from '@/lib/util'
import { defaultMicroLimits, type NutrientKey, type TargetKind } from '@/lib/nutrients'
import type { TargetValues } from '@/lib/targets'
import type { TargetRow } from '@/types/db'

type MicroLimits = Partial<Record<NutrientKey, { kind: TargetKind; value: number }>>

/** The target in effect for a given day: the most recent row on/before that date. */
export async function getCurrentTarget(date = todayISO()): Promise<TargetRow | undefined> {
  const onOrBefore = await db.targets.where('effective_date').belowOrEqual(date).toArray()
  if (onOrBefore.length) {
    return onOrBefore.sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0]
  }
  // Before any target's effective date — fall back to the earliest we have.
  const all = await db.targets.orderBy('effective_date').toArray()
  return all[0]
}

/** Save a new dated target row (manual or adaptive). Micro limits default to references. */
export async function saveTarget(
  v: TargetValues,
  opts: { origin?: 'manual' | 'adaptive'; microLimits?: MicroLimits; date?: string } = {},
): Promise<void> {
  const userId = await currentUserId()
  const row: TargetRow = {
    id: uuid(),
    user_id: userId,
    effective_date: opts.date ?? todayISO(),
    energy: v.energy,
    protein: v.protein,
    carbs: v.carbs,
    fat: v.fat,
    micro_limits: opts.microLimits ?? defaultMicroLimits(),
    origin: opts.origin ?? 'manual',
    created_at: new Date().toISOString(),
  }
  await queueMutation({
    table: 'targets',
    op: 'upsert',
    payload: row as unknown as Record<string, unknown>,
    client_uuid: row.id,
    localApply: async () => {
      await db.targets.put(row)
    },
  })
}
