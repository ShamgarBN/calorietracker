import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from './Modal'
import { db } from '@/lib/db'
import { getProfile, updateProfile } from '@/data/profile'
import { saveTarget } from '@/data/targets'
import { computeTargets } from '@/lib/targets'
import { usePrefs } from '@/lib/prefs'
import { fromKg, toKg, weightUnitFor } from '@/lib/units'
import type { Profile, Sex } from '@/types/db'

const ACTIVITY_OPTS: { value: Profile['activity_level']; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary (little exercise)' },
  { value: 'light', label: 'Light (1–3 days/wk)' },
  { value: 'moderate', label: 'Moderate (3–5 days/wk)' },
  { value: 'active', label: 'Active (6–7 days/wk)' },
  { value: 'very_active', label: 'Very active (physical job/2x day)' },
]

export function GoalSetup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const system = usePrefs((s) => s.system)
  const imperial = system === 'imperial'
  const unit = weightUnitFor(system)
  const latestWeight = useLiveQuery(
    () => db.weight_entries.orderBy('date').filter((w) => !w.deleted).last(),
    [],
  )
  const currentKg = latestWeight?.weight_kg ?? null

  const [sex, setSex] = useState<Sex>('male')
  const [birthYear, setBirthYear] = useState('')
  const [heightInput, setHeightInput] = useState('') // raw text, in display unit (in or cm)
  const [activity, setActivity] = useState<Profile['activity_level']>('moderate')
  const [direction, setDirection] = useState<Profile['goal_direction']>('maintain')
  const [goalWeight, setGoalWeight] = useState('') // in display unit
  const [ratePerWeek, setRatePerWeek] = useState('0.5') // magnitude, display unit/week
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void getProfile().then((p) => {
      if (!p) return
      if (p.sex) setSex(p.sex)
      if (p.birth_year) setBirthYear(String(p.birth_year))
      if (p.height_cm) setHeightInput(imperial ? (p.height_cm / 2.54).toFixed(1) : String(p.height_cm))
      setActivity(p.activity_level)
      setDirection(p.goal_direction)
      if (p.goal_weight_kg != null) setGoalWeight(fromKg(p.goal_weight_kg, unit).toFixed(1))
      if (p.goal_rate_kg_per_week) setRatePerWeek(Math.abs(fromKg(p.goal_rate_kg_per_week, unit)).toFixed(2))
    })
  }, [open, unit])

  // Keep the raw text the user types (in inches or cm); convert to cm only when
  // computing the preview / saving — never reformat mid-typing.
  const heightCm = heightInput
    ? imperial
      ? Number(heightInput) * 2.54
      : Number(heightInput)
    : null
  const heightValid = heightCm != null && Number.isFinite(heightCm) && heightCm > 0

  const rateKgPerWeek =
    direction === 'maintain' ? 0 : toKg(parseFloat(ratePerWeek) || 0, unit) * (direction === 'lose' ? -1 : 1)

  const preview =
    currentKg != null && birthYear && heightValid
      ? computeTargets(
          {
            sex,
            height_cm: heightCm,
            birth_year: Number(birthYear),
            activity_level: activity,
            goal_rate_kg_per_week: rateKgPerWeek,
          },
          currentKg,
        )
      : null

  async function save() {
    if (!preview) return
    setSaving(true)
    await updateProfile({
      sex,
      birth_year: Number(birthYear) || null,
      height_cm: heightValid ? Math.round(heightCm) : null,
      activity_level: activity,
      goal_direction: direction,
      goal_weight_kg: goalWeight ? toKg(parseFloat(goalWeight), unit) : null,
      goal_rate_kg_per_week: rateKgPerWeek,
    })
    await saveTarget({
      energy: preview.energy,
      protein: preview.protein,
      carbs: preview.carbs,
      fat: preview.fat,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Goals & targets">
      <div className="space-y-4">
        {currentKg == null && (
          <p className="rounded-lg border border-[var(--color-warn)] bg-[var(--color-warn)]/10 px-3 py-2 text-sm text-[var(--color-warn)]">
            Log a weigh-in first — your targets are calculated from your current weight.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sex (for BMR)">
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className={cls}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Birth year">
            <input type="number" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className={cls} placeholder="1990" />
          </Field>
          <Field label={imperial ? 'Height (in)' : 'Height (cm)'}>
            <input type="number" inputMode="decimal" value={heightInput} onChange={(e) => setHeightInput(e.target.value)} className={cls} />
          </Field>
          <Field label="Activity">
            <select value={activity} onChange={(e) => setActivity(e.target.value as Profile['activity_level'])} className={cls}>
              {ACTIVITY_OPTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Goal">
          <select value={direction} onChange={(e) => setDirection(e.target.value as Profile['goal_direction'])} className={cls}>
            <option value="lose">Lose weight</option>
            <option value="maintain">Maintain</option>
            <option value="gain">Gain weight</option>
          </select>
        </Field>

        {direction !== 'maintain' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Target weight (${unit})`}>
              <input type="number" inputMode="decimal" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} className={cls} />
            </Field>
            <Field label={`Rate (${unit}/week)`}>
              <input type="number" inputMode="decimal" step="0.1" value={ratePerWeek} onChange={(e) => setRatePerWeek(e.target.value)} className={cls} />
            </Field>
          </div>
        )}

        {preview ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="mb-2 text-xs text-muted">
              Daily target · TDEE ≈ {preview.tdee} kcal
              {preview.dailyAdjust !== 0 && ` · ${preview.dailyAdjust > 0 ? '+' : ''}${preview.dailyAdjust} for your goal`}
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="kcal" value={preview.energy} tone="text-[var(--color-text)]" />
              <Stat label="P (g)" value={preview.protein} tone="text-[var(--color-protein)]" />
              <Stat label="C (g)" value={preview.carbs} tone="text-[var(--color-carbs)]" />
              <Stat label="F (g)" value={preview.fat} tone="text-[var(--color-fat)]" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Fill in sex, birth year, and height to see your targets.</p>
        )}

        <button
          onClick={save}
          disabled={!preview || saving}
          className="w-full rounded-lg bg-[var(--color-brand)] px-3 py-2.5 font-medium text-black disabled:opacity-60"
        >
          Save targets
        </button>
      </div>
    </Modal>
  )
}

const cls =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
