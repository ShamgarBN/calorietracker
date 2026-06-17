import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UnitSystem } from './units'
import { env } from './env'
import { updateProfile } from '@/data/profile'

// Lightweight on-device UI preferences, persisted to localStorage so they apply
// instantly and offline. Values are ALWAYS stored in metric in the database (kg,
// grams, ml); this only controls display/entry. Default is US Imperial. Best-effort
// mirrored to profile.units so the choice follows you across devices.

interface PrefsState {
  system: UnitSystem
  setSystem: (s: UnitSystem) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      system: 'imperial',
      setSystem: (system) => {
        set({ system })
        void mirrorToProfile(system)
      },
    }),
    {
      name: 'ct-prefs',
      version: 2,
      // Migrate the old { weightUnit: 'kg' | 'lb' } shape to a full unit system.
      migrate: (persisted: unknown, version: number): PrefsState => {
        if (version < 2 && persisted && typeof persisted === 'object' && 'weightUnit' in persisted) {
          const wu = (persisted as { weightUnit?: string }).weightUnit
          return { system: wu === 'kg' ? 'metric' : 'imperial' } as PrefsState
        }
        return persisted as PrefsState
      },
    },
  ),
)

async function mirrorToProfile(system: UnitSystem): Promise<void> {
  if (!env.isConfigured) return
  try {
    // Full-row merge (never a partial upsert — see data/profile.ts).
    await updateProfile({ units: system })
  } catch {
    // Non-fatal — local preference still applies.
  }
}
