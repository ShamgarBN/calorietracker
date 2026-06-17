import { describe, it, expect } from 'vitest'
import { estimateExpenditure } from './adaptive'
import { mifflinStJeor, computeTargets } from './targets'
import { microReport } from './analytics'
import type { Nutrients } from './nutrients'

function intakeDays(start: string, n: number, kcal: number): Map<string, number> {
  const m = new Map<string, number>()
  const d = new Date(start + 'T00:00:00')
  for (let i = 0; i < n; i++) {
    m.set(d.toISOString().slice(0, 10), kcal)
    d.setDate(d.getDate() + 1)
  }
  return m
}

describe('estimateExpenditure', () => {
  it('recovers true expenditure from intake + trend-weight change', () => {
    // Ate 2000 kcal/day for 14 days; trend weight fell 1.0 kg over the window.
    // True expenditure = 2000 + (1.0 kg * 7700)/14 = 2550 kcal/day.
    const today = '2026-06-15'
    const r = estimateExpenditure({
      dailyEnergy: intakeDays('2026-06-02', 14, 2000),
      weights: [
        { date: '2026-06-01', trend_kg: 80.0 },
        { date: '2026-06-15', trend_kg: 79.0 },
      ],
      targetEnergy: 2000,
      priorEstimate: null,
      baselineTDEE: null,
      today,
    })
    expect(r.usable).toBe(true)
    expect(r.meanIntake).toBe(2000)
    expect(r.trendDeltaKg).toBeCloseTo(-1.0, 5)
    expect(r.estimate).toBe(2550)
  })

  it('blends toward the prior when confidence is low (few weigh-ins)', () => {
    const r = estimateExpenditure({
      dailyEnergy: intakeDays('2026-06-12', 3, 2000), // only 3 logged days
      weights: [{ date: '2026-06-14', trend_kg: 80 }],
      targetEnergy: 2000,
      priorEstimate: 2400,
      baselineTDEE: 2400,
      today: '2026-06-15',
    })
    expect(r.usable).toBe(false)
    expect(r.estimate).toBe(2400) // falls back to prior
  })

  it('weighted blend stays between observation and prior', () => {
    const r = estimateExpenditure({
      dailyEnergy: intakeDays('2026-06-02', 14, 1800),
      weights: [
        { date: '2026-06-01', trend_kg: 75 },
        { date: '2026-06-08', trend_kg: 74.6 },
        { date: '2026-06-15', trend_kg: 74.3 },
      ],
      targetEnergy: 1800,
      priorEstimate: 2600,
      baselineTDEE: 2600,
      today: '2026-06-15',
    })
    // observed > 1800 (losing weight while eating 1800); estimate between obs & prior
    expect(r.usable).toBe(true)
    expect(r.estimate).toBeGreaterThan(1800)
    expect(r.estimate).toBeLessThanOrEqual(2600)
  })
})

describe('targets math', () => {
  it('Mifflin-St Jeor matches the textbook formula', () => {
    // male, 80kg, 185cm, 36y -> 10*80 + 6.25*185 - 5*36 + 5 = 1781.25
    expect(mifflinStJeor('male', 80, 185, 36)).toBeCloseTo(1781.25, 2)
  })
  it('computeTargets applies activity + goal and splits macros sanely', () => {
    const t = computeTargets(
      { sex: 'male', height_cm: 185, birth_year: 1990, activity_level: 'moderate', goal_rate_kg_per_week: -0.5 },
      80,
    )!
    expect(t).not.toBeNull()
    expect(t.tdee).toBeGreaterThan(t.bmr)
    expect(t.dailyAdjust).toBeLessThan(0) // deficit for loss
    expect(t.protein).toBe(144) // 1.8 * 80
    // macros reconstruct the calorie target (±rounding)
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.energy)).toBeLessThanOrEqual(8)
  })
})

describe('microReport', () => {
  it('flags shortfalls and overages vs limits', () => {
    const daily = new Map<string, Nutrients>([
      ['2026-06-15', { energy: 2000, iron: 4, sodium: 3500, vitaminC: 120 }],
      ['2026-06-14', { energy: 2000, iron: 4, sodium: 3500, vitaminC: 120 }],
    ])
    const { rows } = microReport(
      daily,
      { iron: { kind: 'floor', value: 8 }, sodium: { kind: 'ceiling', value: 2300 }, vitaminC: { kind: 'floor', value: 90 } },
      7,
    )
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.status]))
    expect(byKey.iron).toBe('short') // 4 vs 8 floor
    expect(byKey.sodium).toBe('over') // 3500 vs 2300 ceiling
    expect(byKey.vitaminC).toBe('ok') // 120 vs 90 floor
  })
})
