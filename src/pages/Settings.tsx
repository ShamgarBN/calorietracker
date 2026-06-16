import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { storageEstimate } from '@/lib/storage'
import { useSyncStore } from '@/lib/sync'
import { usePrefs } from '@/lib/prefs'
import type { WeightUnit } from '@/lib/units'

export function Settings() {
  const { pending, lastSyncedAt } = useSyncStore()
  const { weightUnit, setWeightUnit } = usePrefs()
  const [email, setEmail] = useState<string | null>(null)
  const [storage, setStorage] = useState<string>('—')

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    void storageEstimate().then((est) => {
      if (est) setStorage(`${(est.usage / 1e6).toFixed(1)} MB used`)
    })
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Settings</h2>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Weight unit</span>
          <div
            role="radiogroup"
            aria-label="Weight unit"
            className="flex overflow-hidden rounded-lg border border-[var(--color-border)]"
          >
            {(['kg', 'lb'] as WeightUnit[]).map((u) => (
              <button
                key={u}
                role="radio"
                aria-checked={weightUnit === u}
                onClick={() => setWeightUnit(u)}
                className={`px-4 py-1.5 text-sm ${
                  weightUnit === u
                    ? 'bg-[var(--color-brand)] font-medium text-black'
                    : 'text-muted hover:text-[var(--color-text)]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
        <Row label="Signed in as" value={email ?? '—'} />
        <Row label="Pending sync" value={`${pending} item(s)`} />
        <Row
          label="Last synced"
          value={lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'never'}
        />
        <Row label="Local storage" value={storage} />
      </section>

      <button
        onClick={() => void supabase.auth.signOut()}
        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-warn)]"
      >
        Sign out
      </button>

      <p className="text-center text-xs text-muted">
        Goals, units, dietary preferences, and data export land in Phases 2 & 6.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  )
}
