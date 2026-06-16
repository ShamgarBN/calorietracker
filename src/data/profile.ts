import { db } from '@/lib/db'
import { queueMutation } from '@/lib/sync'
import { supabase, currentUserId } from '@/lib/supabase'
import type { Profile } from '@/types/db'

// Profile is a single row per user. IMPORTANT: a PostgREST upsert resets columns
// NOT included in the payload to their defaults — so we always merge a patch over
// the full local row and write the WHOLE row back. Never upsert a partial profile.

export function defaultProfile(userId: string, email?: string | null): Profile {
  return {
    user_id: userId,
    display_name: email ? email.split('@')[0] : null,
    sex: null,
    birth_year: null,
    height_cm: null,
    units: 'metric',
    activity_level: 'moderate',
    goal_direction: 'maintain',
    goal_weight_kg: null,
    goal_rate_kg_per_week: 0,
    diet_prefs: [],
    exclusions: [],
    updated_at: new Date().toISOString(),
  }
}

export async function getProfile(): Promise<Profile | undefined> {
  const userId = await currentUserId()
  if (userId === 'local') return undefined
  return db.profile.get(userId)
}

/** Merge a patch over the existing (synced) profile row and persist the full row. */
export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Not signed in')
  const existing = (await db.profile.get(userId)) ?? defaultProfile(userId, data.user?.email)
  const updated: Profile = { ...existing, ...patch, user_id: userId, updated_at: new Date().toISOString() }
  await queueMutation({
    table: 'profile',
    op: 'upsert',
    payload: updated as unknown as Record<string, unknown>,
    client_uuid: userId,
    localApply: async () => {
      await db.profile.put(updated)
    },
  })
  return updated
}
