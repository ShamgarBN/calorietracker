import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { currentUserId } from '@/lib/supabase'
import { uuid, todayISO } from '@/lib/util'
import type { WaterEntry } from '@/types/db'

export async function addWater(ml: number, date = todayISO()): Promise<void> {
  const userId = await currentUserId()
  const now = new Date().toISOString()
  const row: WaterEntry = {
    id: uuid(),
    user_id: userId,
    client_uuid: uuid(),
    date,
    ml,
    deleted: false,
    created_at: now,
    updated_at: now,
  }
  await queueMutation({
    table: 'water_entries',
    op: 'upsert',
    payload: row as unknown as Record<string, unknown>,
    client_uuid: row.client_uuid,
    localApply: async () => {
      await db.water_entries.put(row)
    },
  })
}

/** Remove the most recent water entry for a day (undo). */
export async function undoWater(date = todayISO()): Promise<void> {
  const rows = (await db.water_entries.where('date').equals(date).toArray()).filter((w) => !w.deleted)
  const last = rows.sort((a, b) => a.created_at.localeCompare(b.created_at)).pop()
  if (!last) return
  await queueMutation({
    table: 'water_entries',
    op: 'upsert',
    payload: { ...last, deleted: true, updated_at: new Date().toISOString() } as unknown as Record<string, unknown>,
    client_uuid: last.client_uuid,
    localApply: async () => {
      await db.water_entries.update(last.client_uuid, { deleted: true })
    },
  })
}
