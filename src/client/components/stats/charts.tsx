import { motion } from 'motion/react'
import { cn } from '@client/lib/utils'
import { formatMinutes } from '@client/lib/date'
import { intensity } from '@client/lib/streaks'

/** Section wrapper so every panel on the Stats page shares one frame. */
export function Panel({
  title, hint, children, className, action,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={cn('rounded-xl bg-surface-2 p-4 ring-1 ring-border', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13.5px] font-semibold leading-tight">{title}</h3>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Big radial gauge for the readiness score. */
export function Gauge({
  value, label, caption, color,
}: { value: number | null; label: string; caption: string; color: string }) {
  const size = 148
  const stroke = 11
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  // Leave a gap at the bottom so it reads as a gauge rather than a pie.
  const sweep = 0.78
  const filled = value === null ? 0 : (value / 100) * sweep

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-[125deg]">
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="var(--surface-3)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${circ * sweep} ${circ}`}
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ * (1 - filled) }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {value === null ? (
            <span className="text-[26px] font-semibold text-muted-foreground">—</span>
          ) : (
            <motion.span
              key={value}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[38px] font-semibold leading-none tabular-nums"
            >
              {value}
            </motion.span>
          )}
          <span className="mt-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</span>
        </div>
      </div>

      <p className="mt-1 text-[12.5px] font-medium" style={{ color }}>{caption}</p>
    </div>
  )
}

/** Horizontal weighted bar used for readiness components. */
export function ComponentBar({
  label, value, weight, detail, isWeakest,
}: {
  label: string
  value: number | null
  weight: number
  detail: string
  isWeakest?: boolean
}) {
  const pct = value === null ? 0 : Math.round(value * 100)
  const color = value === null
    ? 'var(--surface-3)'
    : isWeakest
      ? 'var(--ev-orange)'
      : 'var(--primary)'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium">
          {label}
          {isWeakest && (
            <span className="rounded-full bg-[color-mix(in_oklch,var(--ev-orange)_18%,transparent)] px-1.5 py-px text-[9.5px] text-[var(--ev-orange)]">
              focus here
            </span>
          )}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {value === null ? 'no data' : `${pct}%`}
          <span className="ml-1.5 opacity-60">w{weight}</span>
        </span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <p className="mt-1 text-[10.5px] text-muted-foreground">{detail}</p>
    </div>
  )
}

/** Bar chart of minutes per day. */
export function MinutesChart({ data }: { data: { date: string; minutes: number }[] }) {
  const max = Math.max(...data.map(d => d.minutes), 1)
  const hasAny = data.some(d => d.minutes > 0)

  if (!hasAny) {
    return (
      <p className="py-10 text-center text-[12px] text-muted-foreground">
        No focus sessions logged yet. Start a timer from the planner.
      </p>
    )
  }

  return (
    <div>
      <div className="flex h-[120px] items-end gap-[3px]">
        {data.map((d, i) => {
          const h = (d.minutes / max) * 100
          return (
            <motion.div
              key={d.date}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(h, d.minutes > 0 ? 4 : 1.5)}%` }}
              transition={{ duration: 0.5, delay: i * 0.01, ease: 'easeOut' }}
              title={`${d.date}: ${formatMinutes(d.minutes)}`}
              className={cn(
                'flex-1 rounded-sm transition-colors',
                d.minutes > 0 ? 'bg-primary hover:bg-primary/80' : 'bg-surface-3'
              )}
            />
          )
        })}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.date.slice(5)}</span>
        <span className="tabular-nums">peak {formatMinutes(max)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}

/** GitHub-style activity heatmap. */
export function Heatmap({
  weeks, max, unit = 'min',
}: {
  weeks: { date: string; value: number; inFuture: boolean }[][]
  max: number
  unit?: string
}) {
  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map(day => (
              <div
                key={day.date}
                title={day.inFuture ? day.date : `${day.date}: ${day.value} ${unit}`}
                className={cn(
                  'h-[11px] w-[11px] rounded-[2px]',
                  day.inFuture && 'opacity-0'
                )}
                style={
                  day.inFuture
                    ? undefined
                    : {
                        background: day.value > 0
                          ? `color-mix(in oklch, var(--primary) ${18 + intensity(day.value, max) * 20}%, var(--surface-3))`
                          : 'var(--surface-3)',
                      }
                }
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>less</span>
        {[0, 1, 2, 3, 4].map(level => (
          <span
            key={level}
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{
              background: level === 0
                ? 'var(--surface-3)'
                : `color-mix(in oklch, var(--primary) ${18 + level * 20}%, var(--surface-3))`,
            }}
          />
        ))}
        <span>more</span>
      </div>
    </div>
  )
}

/** Stacked proportion bar with a legend, for categorical splits. */
export function SplitBar({
  segments, total,
}: {
  segments: { label: string; value: number; color: string }[]
  total: number
}) {
  if (total === 0) {
    return <p className="py-6 text-center text-[12px] text-muted-foreground">Nothing logged yet.</p>
  }

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
        {segments.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ width: 0 }}
            animate={{ width: `${(s.value / total) * 100}%` }}
            transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' }}
            style={{ background: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 text-muted-foreground">{s.label}</span>
            <span className="tabular-nums font-medium">{s.value}</span>
            <span className="w-9 text-right tabular-nums text-muted-foreground">
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Compact metric tile. */
export function Metric({
  label, value, sub, accent, icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  icon?: React.ComponentType<any>
}) {
  return (
    <div
      className="rounded-xl p-3.5 ring-1 ring-border"
      style={{ background: accent ? 'var(--grad-selected)' : 'var(--surface-2)' }}
    >
      <div className="flex items-center gap-1.5">
        {Icon && (
          <Icon className={cn('h-3 w-3', accent ? 'text-white/80' : 'text-muted-foreground')} />
        )}
        <p className={cn('text-[11px]', accent ? 'text-white/80' : 'text-muted-foreground')}>{label}</p>
      </div>
      <p className={cn('mt-1.5 text-[22px] font-semibold leading-none tabular-nums', accent && 'text-white')}>
        {value}
      </p>
      {sub && (
        <p className={cn('mt-1 text-[10.5px]', accent ? 'text-white/70' : 'text-muted-foreground')}>{sub}</p>
      )}
    </div>
  )
}
