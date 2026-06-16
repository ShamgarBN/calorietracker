import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WeightUnit } from './units'
import { supabase } from './supabase'
import { env } from './env'

// Lightweight on-device UI preferences, persisted to localStorage so they apply
// instantly and offline. Weight is still ALWAYS stored as kg in the database;
// this only controls display/entry. Best-effort mirrored to profile.units so the
// choice follows you to other devices (full profile hydration lands in Phase 2).

interface PrefsState {
  weightUnit: WeightUnit
  setWeightUnit: (u: WeightUnit) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      weightUnit: 'kg',
      setWeightUnit: (weightUnit) => {
        set({ weightUnit })
        void mirrorToProfile(weightUnit)
      },
    }),
    { name: 'ct-prefs' },
  ),
)

async function mirrorToProfile(unit: WeightUnit): Promise<void> {
  if (!env.isConfigured) return
  try {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    await supabase
      .from('profile')
      .upsert(
        { user_id: data.user.id, units: unit === 'lb' ? 'imperial' : 'metric' },
        { onConflict: 'user_id' },
      )
  } catch {
    // Non-fatal — local preference still applies.
  }
}
