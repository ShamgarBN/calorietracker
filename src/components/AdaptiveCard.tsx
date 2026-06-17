import { useEffect, useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { computeCurrentExpenditure, applyAdaptiveTargets } from '@/data/adaptive'
import type { AdaptiveResult } from '@/lib/adaptive'

// Shows the adaptive expenditure estimate + "why", and lets the user apply it to
// their targets (preserving the goal rate). This is the MacroFactor-style loop.
export function AdaptiveCard() {
  const [result, setResult] = useState<AdaptiveResult | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    void computeCurrentExpenditure().then(setResult)
  }, [])

  async function apply() {
    setApplying(true)
    await applyAdaptiveTargets()
    setApplied(true)
    setApplying(false)
    setResult(await computeCurrentExpenditure())
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-muted">
        <Activity size={14} /> Adaptive expenditure
      </h3>

      {result ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">{result.estimate}</span>
            <span className="text-sm text-muted">kcal/day estimated TDEE</span>
          </div>
          {result.usable && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${result.confidence * 100}%` }} />
            </div>
          )}
          <p className="mt-2 text-xs leading-relaxed text-muted">{result.note}</p>

          {result.usable ? (
            <button
              onClick={apply}
              disabled={applying}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
            >
              <RefreshCw size={14} className={applying ? 'animate-spin' : ''} />
              {applied ? 'Targets updated' : 'Apply to my targets'}
            </button>
          ) : (
            <p className="mt-3 text-xs text-muted">
              Log most days and weigh in a few times a week — the estimate sharpens automatically.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Calculating…</p>
      )}
    </section>
  )
}
