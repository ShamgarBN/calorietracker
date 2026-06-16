import type { ReactNode } from 'react'

// Circular progress ring (SVG). Over-target shows a warm "over" color.
export function ProgressRing({
  value,
  target,
  size = 132,
  stroke = 12,
  color = 'var(--color-brand)',
  overColor = 'var(--color-warn)',
  children,
}: {
  value: number
  target: number
  size?: number
  stroke?: number
  color?: string
  overColor?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = target > 0 ? value / target : 0
  const shown = Math.min(pct, 1)
  const offset = c * (1 - shown)
  const isOver = pct > 1.0001

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isOver ? overColor : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 300ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** Horizontal macro progress bar with label + values. */
export function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string
  value: number
  target: number
  color: string
}) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0
  const over = target > 0 && value > target * 1.0001
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          <span className={over ? 'text-[var(--color-warn)]' : ''}>{Math.round(value)}</span>
          <span className="text-muted"> / {Math.round(target)}g</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct * 100}%`, background: over ? 'var(--color-warn)' : color }}
        />
      </div>
    </div>
  )
}
