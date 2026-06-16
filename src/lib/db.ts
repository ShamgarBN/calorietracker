import Dexie, { type EntityTable } from 'dexie'
import type { Food, LogEntry, OutboxItem, Profile, TargetRow, WeightEntry } from '@/types/db'

// Local mirror of the user's data + the durable write outbox.
//
// Design rule (see plan §2E): this DB is a CACHE and an OUTBOX, never the source of
// truth. Reads render from here for instant/offline UX; writes are appended to
// `outbox` and ALSO applied optimistically to the cache table, then the sync engine
// pushes the outbox to Supabase. If IndexedDB is evicted, nothing is lost that wasn't
// already synced — and a pull from Supabase repopulates the cache.

class AppDB extends Dexie {
  foods!: EntityTable<Food, 'id'>
  log_entries!: EntityTable<LogEntry, 'client_uuid'>
  weight_entries!: EntityTable<WeightEntry, 'client_uuid'>
  targets!: EntityTable<TargetRow, 'id'>
  profile!: EntityTable<Profile, 'user_id'>
  outbox!: EntityTable<OutboxItem, 'id'>
  meta!: EntityTable<{ key: string; value: unknown }, 'key'>

  constructor() {
    super('calorie-tracker')
    this.version(1).stores({
      foods: 'id, source, barcode, name, updated_at',
      log_entries: 'client_uuid, id, date, [date+meal_slot], source, updated_at, deleted',
      weight_entries: 'client_uuid, id, date, updated_at, deleted',
      targets: 'id, effective_date',
      outbox: '++id, client_uuid, table, queued_at',
      meta: 'key',
    })
    // v2: dedupe foods by (source, source_id). (favorite is a boolean — not
    // indexable in IndexedDB — so we filter it in memory; the table is small.)
    this.version(2).stores({
      foods: 'id, source, barcode, name, updated_at, [source+source_id]',
    })
    // v3: cache the single profile row locally for offline goal/target reads.
    this.version(3).stores({
      profile: 'user_id, updated_at',
    })
  }
}

export const db = new AppDB()

/** Sync cursor per table: the max `updated_at` we've pulled so far. */
export async function getSyncCursor(table: string): Promise<string | null> {
  const row = await db.meta.get(`cursor:${table}`)
  return (row?.value as string) ?? null
}

export async function setSyncCursor(table: string, value: string): Promise<void> {
  await db.meta.put({ key: `cursor:${table}`, value })
}
