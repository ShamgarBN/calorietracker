import { useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { env } from '@/lib/env'
import { useAuth } from '@/hooks/useAuth'

/** Gates the app behind Supabase config + a logged-in session. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (!env.isConfigured) return <SetupScreen />
  if (loading) return <Centered>Loading…</Centered>
  if (!session) return <LoginScreen />
  return <>{children}</>
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6 text-center text-muted">
      {children}
    </div>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        {children}
      </div>
    </div>
  )
}

function SetupScreen() {
  return (
    <Card>
      <h1 className="mb-2 text-lg font-semibold">Almost there</h1>
      <p className="mb-4 text-sm text-muted">
        Supabase isn’t configured yet. Create a project, run{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1">supabase/schema.sql</code>, then add
        a <code className="rounded bg-[var(--color-surface-2)] px-1">.env.local</code> with:
      </p>
      <pre className="overflow-x-auto rounded-lg bg-[var(--color-bg)] p-3 text-xs text-[var(--color-brand)]">
        {`VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...`}
      </pre>
      <p className="mt-4 text-xs text-muted">See the README for the full setup walkthrough.</p>
    </Card>
  )
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      setError(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <Card>
      <h1 className="mb-1 text-lg font-semibold">
        <span className="text-[var(--color-brand)]">●</span> Macros
      </h1>
      <p className="mb-5 text-sm text-muted">Sign in to sync across your devices.</p>

      {status === 'sent' ? (
        <p className="text-sm text-[var(--color-brand)]">
          Check your email for a magic link. Open it on this device to finish signing in.
        </p>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <label className="block text-sm" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-lg bg-[var(--color-brand)] px-3 py-2 font-medium text-black disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {status === 'error' && <p className="text-sm text-[var(--color-warn)]">{error}</p>}
        </form>
      )}
    </Card>
  )
}
