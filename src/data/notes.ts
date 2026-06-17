import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { currentUserId } from '@/lib/supabase'
import { todayISO } from '@/lib/util'
import type { DayNote } from '@/types/db'

export async function getNote(date = todayISO()): Promise<string> {
  return (await db.day_notes.get(date))?.note ?? ''
}

export async function setNote(note: string, date = todayISO()): Promise<void> {
  const userId = await currentUserId()
  const row: DayNote = { user_id: userId, date, note, updated_at: new Date().toISOString() }
  await queueMutation({
    table: 'day_notes',
    op: 'upsert',
    payload: row as unknown as Record<string, unknown>,
    client_uuid: date, // local key
    localApply: async () => {
      await db.day_notes.put(row)
    },
  })
}
