// Weight-entry data access. Demonstrates the full offline write path end-to-end
// (optimistic local cache + durable outbox + sync) used by every feature later.

import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { supabase } from '@/lib/supabase'
import { uuid, todayISO } from '@/lib/util'
import type { WeightEntry } from '@/types/db'

/** EWMA "trend weight" smoothing — the basis for the adaptive engine later. */
const TREND_ALPHA = 0.1

export async function logWeight(weightKg: number, date = todayISO()): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? 'local'

  // Compute trend from the most recent prior entry in the local cache.
  const prior = await db.weight_entries
    .where('date')
    .belowOrEqual(date)
    .filter((w) => !w.deleted)
    .last()
  const trend = prior?.trend_kg != null ? prior.trend_kg + TREND_ALPHA * (weightKg - prior.trend_kg) : weightKg

  const now = new Date().toISOString()
  const row: WeightEntry = {
    id: uuid(),
    user_id: userId,
    client_uuid: uuid(),
    date,
    weight_kg: weightKg,
    trend_kg: Number(trend.toFixed(2)),
    source: 'manual',
    created_at: now,
    updated_at: now,
    deleted: false,
  }

  await queueMutation({
    table: 'weight_entries',
    op: 'upsert',
    payload: row as unknown as Record<string, unknown>,
    client_uuid: row.client_uuid,
    localApply: async () => {
      await db.weight_entries.put(row)
    },
  })
}

export async function recentWeights(limit = 30): Promise<WeightEntry[]> {
  const all = await db.weight_entries.orderBy('date').filter((w) => !w.deleted).toArray()
  return all.slice(-limit)
}
