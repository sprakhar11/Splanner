import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Clock, Target, Heart, CalendarDays } from 'lucide-react'
import { useSettings } from '@client/hooks/useSettings'
import { cn } from '@client/lib/utils'

const EXPECTED_YEARS = 80
const WEEKS_PER_YEAR = 52
const TOTAL_WEEKS = EXPECTED_YEARS * WEEKS_PER_YEAR

type Goal = { name: string; deadline: string; addedOn: string }

function parseGoals(raw: string | undefined): Goal[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function parseDOB(raw: string | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function weeksBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
}

function pct(n: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((n / total) * 1000) / 10))
}

export default function Life() {
  const { data: settings } = useSettings()
  const dob = parseDOB(settings?.dob)
  const goals = parseGoals(settings?.lifeGoals)
  const expectedYears = Number(settings?.lifeExpectedYears) || EXPECTED_YEARS

  const now = new Date()
  const totalWeeks = expectedYears * WEEKS_PER_YEAR

  const life = useMemo(() => {
    if (!dob) return null
    const weeksLived = weeksBetween(dob, now)
    const yearsLived = Math.floor(weeksLived / 52)
    const weeksLeft = Math.max(0, totalWeeks - weeksLived)
    return { weeksLived, weeksLeft, yearsLived, totalWeeks }
  }, [dob, totalWeeks])

  // Time left in current month
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysLeftMonth = daysBetween(now, monthEnd)
  const totalDaysMonth = monthEnd.getDate()
  const monthPct = pct(totalDaysMonth - daysLeftMonth, totalDaysMonth)

  // Time left in current year
  const yearEnd = new Date(now.getFullYear(), 11, 31)
  const daysLeftYear = daysBetween(now, yearEnd)
  const totalDaysYear = (new Date(now.getFullYear(), 11, 31).getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1
  const yearPct = pct(totalDaysYear - daysLeftYear, totalDaysYear)

  if (!dob) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl bg-surface-2 p-6 ring-1 ring-border">
        <Heart className="mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="text-[17px] font-semibold">Set your date of birth</h2>
        <p className="mt-2 text-center text-[13px] text-muted-foreground">
          Go to Settings and add your DOB to see your life calendar.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="mb-4">
        <h2 className="text-[17px] font-semibold tracking-tight">Life</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {life!.yearsLived} years lived
        </p>
      </div>

      {/* Time metrics */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <TimeCard
          icon={CalendarDays}
          label="Month"
          pct={monthPct}
          sub={now.toLocaleDateString('en-IN', { month: 'long' })}
        />
        <TimeCard
          icon={Clock}
          label="Year"
          pct={yearPct}
          sub={String(now.getFullYear())}
        />
        <TimeCard
          icon={Heart}
          label="Life"
          pct={pct(life!.weeksLived, life!.totalWeeks)}
          sub={`${life!.yearsLived} years`}
          accent
        />
      </div>

      {/* Dot calendar */}
      <div className="mb-4 rounded-xl bg-surface-2 p-4 ring-1 ring-border">
        <h3 className="mb-3 text-[13.5px] font-semibold">Your life in weeks</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Each dot is one week. Filled = lived. {life!.weeksLived.toLocaleString()} of {life!.totalWeeks.toLocaleString()} weeks.
        </p>
        <DotGrid weeksLived={life!.weeksLived} totalWeeks={life!.totalWeeks} yearsTotal={expectedYears} />
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div className="rounded-xl bg-surface-2 p-4 ring-1 ring-border">
          <h3 className="mb-3 text-[13.5px] font-semibold">Goals</h3>
          <div className="space-y-3">
            {goals.map((goal, i) => (
              <GoalCard key={i} goal={goal} now={now} />
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="rounded-xl bg-surface-2 p-4 ring-1 ring-border">
          <h3 className="mb-2 text-[13.5px] font-semibold">Goals</h3>
          <p className="text-[12px] text-muted-foreground">
            Add goals with deadlines in Settings → Life to see countdown progress here.
          </p>
        </div>
      )}
    </div>
  )
}

/* ============================================ components */

function TimeCard({
  icon: Icon, label, pct: progress, sub, accent,
}: {
  icon: React.ComponentType<any>
  label: string
  pct: number
  sub: string
  accent?: boolean
}) {
  const left = Math.round((100 - progress) * 10) / 10
  return (
    <div
      className="rounded-xl p-3.5 ring-1 ring-border"
      style={{ background: accent ? 'var(--grad-selected)' : 'var(--surface-2)' }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3 w-3', accent ? 'text-white/80' : 'text-muted-foreground')} />
        <span className={cn('text-[11px]', accent ? 'text-white/80' : 'text-muted-foreground')}>{label}</span>
      </div>
      <p className={cn('mt-1.5 text-[22px] font-semibold leading-none tabular-nums', accent && 'text-white')}>
        {progress}%
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: accent ? 'rgba(255,255,255,0.6)' : 'var(--primary)' }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <p className={cn('mt-1.5 text-[10.5px]', accent ? 'text-white/70' : 'text-muted-foreground')}>
        {sub}
      </p>
    </div>
  )
}

function GoalCard({ goal, now }: { goal: Goal; now: Date }) {
  const deadline = new Date(goal.deadline + 'T00:00:00')
  const added = new Date(goal.addedOn + 'T00:00:00')
  const totalDays = daysBetween(added, deadline)
  const elapsed = daysBetween(added, now)
  const daysLeft = Math.max(0, daysBetween(now, deadline))
  const progress = totalDays > 0 ? pct(elapsed, totalDays) : 100
  const overdue = now > deadline

  return (
    <div className="rounded-lg bg-surface-3 px-3.5 py-3 ring-1 ring-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight">{goal.name}</p>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            {overdue
              ? `Overdue by ${Math.abs(daysLeft)} days`
              : `${daysLeft} days left · due ${deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <span className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
          overdue ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
        )}>
          {overdue ? 'Overdue' : `${Math.round(progress)}%`}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: overdue ? 'var(--destructive)' : 'var(--primary)' }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>Started {added.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        <span>{elapsed} days elapsed / {totalDays} total</span>
      </div>
    </div>
  )
}

function DotGrid({ weeksLived, totalWeeks, yearsTotal }: { weeksLived: number; totalWeeks: number; yearsTotal: number }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const dob = parseDOB(useSettings().data?.dob)

  const hoverInfo = useMemo(() => {
    if (hovered === null || !dob) return null
    const weekDate = new Date(dob.getTime() + hovered * 7 * 24 * 60 * 60 * 1000)
    const age = Math.floor(hovered / 52)
    const weekInYear = (hovered % 52) + 1
    return {
      week: hovered + 1,
      age,
      weekInYear,
      date: weekDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      lived: hovered < weeksLived,
      isCurrent: hovered === weeksLived,
    }
  }, [hovered, dob, weeksLived])

  return (
    <div className="relative">
      {/* Hover tooltip */}
      {hoverInfo && (
        <div className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-popover px-3 py-1.5 text-[11px] shadow-lg ring-1 ring-border">
          <span className="font-medium">Week {hoverInfo.week}</span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="text-muted-foreground">Age {hoverInfo.age}, Week {hoverInfo.weekInYear}</span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="text-muted-foreground">{hoverInfo.date}</span>
          {hoverInfo.isCurrent && <span className="ml-1.5 text-[var(--ev-orange)]">← you are here</span>}
        </div>
      )}

      <div
        className="flex flex-wrap gap-[1px]"
        style={{ lineHeight: 0 }}
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: totalWeeks }, (_, idx) => {
          const lived = idx < weeksLived
          const isCurrentWeek = idx === weeksLived
          // When hovering a dot, all dots from index 0 to that dot get a highlight
          const inHoverRange = hovered !== null && idx <= hovered
          return (
            <span
              key={idx}
              onMouseEnter={() => setHovered(idx)}
              className={cn(
                'inline-block h-[6px] w-[6px] rounded-full cursor-crosshair transition-colors duration-75',
                // Base colors
                lived && !inHoverRange && 'bg-primary',
                !lived && !isCurrentWeek && !inHoverRange && 'bg-surface-3',
                isCurrentWeek && !inHoverRange && 'bg-[var(--ev-orange)] ring-2 ring-[var(--ev-orange)]/30',
                // Hover range highlight: a lighter shade sweeps from start to hovered dot
                inHoverRange && lived && 'bg-primary/60',
                inHoverRange && !lived && !isCurrentWeek && 'bg-muted-foreground/25',
                inHoverRange && isCurrentWeek && 'bg-[var(--ev-orange)]/60 ring-2 ring-[var(--ev-orange)]/20',
              )}
            />
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Week 1</span>
        <span>Week {weeksLived} (now)</span>
        <span>Week {totalWeeks}</span>
      </div>
    </div>
  )
}
