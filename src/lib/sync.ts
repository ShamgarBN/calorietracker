import { create } from 'zustand'
import { supabase } from './supabase'
import { db, getSyncCursor, setSyncCursor } from './db'
import { env } from './env'

// ---------------------------------------------------------------------------
// Sync engine
//
// Flow for every write in the app:
//   1. apply optimistically to the Dexie cache table (instant UI, offline-safe)
//   2. append a row to the `outbox`
//   3. flush the outbox to Supabase (now if online, later otherwise)
//
// We sync on app open, on `online`, and on tab `visibilitychange` — NOT in the
// background, because iOS PWAs have no background sync. Pulls are incremental via
// an `updated_at` cursor per table. Conflict policy is last-write-wins by row.
// ---------------------------------------------------------------------------

/** Tables we sync, and the column used to resolve upsert conflicts. */
const CONFLICT_TARGET: Record<string, string> = {
  log_entries: 'client_uuid',
  weight_entries: 'client_uuid',
  foods: 'id',
  targets: 'id',
  tdee_estimates: 'id',
  meals: 'id',
  recipes: 'id',
  water_entries: 'client_uuid',
  day_notes: 'user_id,date',
  profile: 'user_id',
}

/** Local Dexie table that mirrors each synced server table (for incremental pulls). */
const PULL_TABLES = ['weight_entries', 'log_entries', 'targets', 'tdee_estimates', 'meals', 'recipes', 'water_entries', 'day_notes', 'foods', 'profile'] as const

/** Column used for the incremental-pull cursor. Append-only tables have no updated_at. */
const CURSOR_COLUMN: Record<string, string> = {
  targets: 'created_at',
  tdee_estimates: 'created_at',
}
const cursorCol = (table: string) => CURSOR_COLUMN[table] ?? 'updated_at'

interface SyncState {
  online: boolean
  syncing: boolean
  pending: number
  lastSyncedAt: number | null
  lastError: string | null
  set: (patch: Partial<SyncState>) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncing: false,
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  set: (patch) => set(patch),
}))

const s = () => useSyncStore.getState()

async function refreshPending() {
  const pending = await db.outbox.count()
  s().set({ pending })
}

async function hasSession(): Promise<boolean> {
  if (!env.isConfigured) return false
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

/**
 * Queue a mutation: optimistic local write + durable outbox entry + best-effort flush.
 * `localApply` runs immediately so the UI updates even fully offline.
 */
export async function queueMutation(args: {
  table: string // one of CONFLICT_TARGET's keys
  op: 'upsert' | 'delete'
  payload: Record<string, unknown>
  client_uuid: string
  localApply: () => Promise<void>
}): Promise<void> {
  await args.localApply()
  await db.outbox.add({
    table: args.table,
    op: args.op,
    payload: args.payload,
    client_uuid: args.client_uuid,
    queued_at: Date.now(),
    tries: 0,
  })
  await refreshPending()
  void flushOutbox()
}

let flushing = false

/** Push queued mutations to Supabase, oldest first. Stops at the first hard failure. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return
  if (!s().online || !(await hasSession())) return
  flushing = true
  s().set({ syncing: true, lastError: null })
  try {
    const items = await db.outbox.orderBy('id').toArray()
    for (const item of items) {
      try {
        if (item.op === 'delete') {
          // Delete by the table's key column (client_uuid for logs, id for meals/etc).
          const keyCol = CONFLICT_TARGET[item.table].split(',')[0]
          const { error } = await supabase.from(item.table).delete().eq(keyCol, item.client_uuid)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from(item.table)
            .upsert(item.payload, { onConflict: CONFLICT_TARGET[item.table] })
          if (error) throw error
        }
        if (item.id != null) await db.outbox.delete(item.id)
      } catch (err) {
        // Leave this item (and the rest) queued; record the error and retry later.
        const msg = err instanceof Error ? err.message : String(err)
        if (item.id != null) {
          await db.outbox.update(item.id, { tries: item.tries + 1, last_error: msg })
        }
        s().set({ lastError: msg })
        break
      }
    }
    await refreshPending()
    s().set({ lastSyncedAt: Date.now() })
  } finally {
    flushing = false
    s().set({ syncing: false })
  }
}

/** Pull rows changed since our cursor into the local cache. */
export async function pullChanges(): Promise<void> {
  if (!s().online || !(await hasSession())) return
  for (const table of PULL_TABLES) {
    try {
      const col = cursorCol(table)
      const cursor = await getSyncCursor(table)
      let q = supabase.from(table).select('*').order(col, { ascending: true }).limit(1000)
      if (cursor) q = q.gt(col, cursor)
      const { data, error } = await q
      if (error) throw error
      if (!data?.length) continue
      // @ts-expect-error dynamic table access; rows match the cache shape by construction
      await db[table].bulkPut(data)
      const maxCursor = data.reduce(
        (m: string, r: Record<string, unknown>) => {
          const v = r[col] as string | undefined
          return v && v > m ? v : m
        },
        cursor ?? '',
      )
      if (maxCursor) await setSyncCursor(table, maxCursor)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      s().set({ lastError: msg })
    }
  }
}

/** Full sync: push local changes then pull remote ones. */
export async function syncNow(): Promise<void> {
  await flushOutbox()
  await pullChanges()
}

let started = false

export function startSyncEngine(): void {
  if (started || typeof window === 'undefined') return
  started = true

  void refreshPending()

  window.addEventListener('online', () => {
    s().set({ online: true })
    void syncNow()
  })
  window.addEventListener('offline', () => s().set({ online: false }))

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })

  // Kick an initial sync shortly after boot (auth/session may still be resolving).
  setTimeout(() => void syncNow(), 800)
}
