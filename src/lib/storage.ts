// iOS evicts script-writable storage (IndexedDB) after ~7 days of no interaction,
// and caps PWA storage tightly. Requesting *persistent* storage materially lowers
// the eviction risk. This is best-effort — Supabase is always the source of truth.

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!('storage' in navigator) || !navigator.storage.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}
