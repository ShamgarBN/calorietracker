import { useEffect, useRef, useState } from 'react'
import { Target, Download, Upload, FileJson } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { storageEstimate } from '@/lib/storage'
import { useSyncStore } from '@/lib/sync'
import { usePrefs } from '@/lib/prefs'
import type { WeightUnit } from '@/lib/units'
import { GoalSetup } from '@/components/GoalSetup'
import { exportAllJson, exportLogCsv, importJson, download } from '@/data/exportImport'

export function Settings() {
  const { pending, lastSyncedAt } = useSyncStore()
  const { weightUnit, setWeightUnit } = usePrefs()
  const [email, setEmail] = useState<string | null>(null)
  const [storage, setStorage] = useState<string>('—')
  const [goalsOpen, setGoalsOpen] = useState(false)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    void storageEstimate().then((est) => {
      if (est) setStorage(`${(est.usage / 1e6).toFixed(1)} MB used`)
    })
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Settings</h2>

      <button
        onClick={() => setGoalsOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Target size={16} className="text-[var(--color-brand)]" /> Goals &amp; targets
        </span>
        <span className="text-xs text-muted">Set up →</span>
      </button>

      <GoalSetup open={goalsOpen} onClose={() => setGoalsOpen(false)} />

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

      <SetPasswordSection />

      <DataSection />

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

function SetPasswordSection() {
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Use at least 6 characters.')
      setStatus('error')
      return
    }
    setStatus('saving')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setStatus('error')
    } else {
      setStatus('done')
      setPassword('')
    }
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-1 text-sm font-medium">Password</h3>
      <p className="mb-3 text-xs text-muted">Set a password to sign in without emailed magic links.</p>
      <form onSubmit={save} className="flex gap-2">
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          aria-label="New password"
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
        />
        <button type="submit" disabled={status === 'saving'} className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-black disabled:opacity-60">
          {status === 'saving' ? 'Saving…' : 'Set'}
        </button>
      </form>
      {status === 'done' && <p className="mt-2 text-xs text-[var(--color-brand)]">Password set. You can now sign in with it.</p>}
      {status === 'error' && <p className="mt-2 text-xs text-[var(--color-warn)]">{error}</p>}
    </section>
  )
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  function stamp() {
    return new Date().toISOString().slice(0, 10)
  }

  async function onImport(file: File) {
    setStatus('Importing…')
    try {
      const result = await importJson(await file.text())
      setStatus(`Imported ${result.total} records. Syncing…`)
    } catch (e) {
      setStatus(e instanceof Error ? `Import failed: ${e.message}` : 'Import failed')
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <FileJson size={15} className="text-[var(--color-brand)]" /> Your data
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={async () => download(await exportAllJson(), `calorie-tracker-${stamp()}.json`)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        >
          <Download size={14} /> Export JSON
        </button>
        <button
          onClick={async () => download(await exportLogCsv(), `food-log-${stamp()}.csv`)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>
      <button
        onClick={() => fileRef.current?.click()}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
      >
        <Upload size={14} /> Import JSON backup
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImport(f)
          e.target.value = ''
        }}
      />
      {status && <p className="text-xs text-muted">{status}</p>}
      <p className="text-xs text-muted">JSON is a full, re-importable backup. CSV is your food log for spreadsheets.</p>
    </section>
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
