import { useMemo, useState } from 'react'
import { Flame, Trophy, CalendarCheck, Timer, Target, CheckCircle2 } from 'lucide-react'
import { useTasks } from '@client/hooks/useTasks'
import { useRevisions } from '@client/hooks/useRevisions'
import { useSettings } from '@client/hooks/useSettings'
import { readSetting } from '@client/lib/settings'
import { useStudySessions, useReflections } from '@client/hooks/useAnalytics'
import { useInterviewStats } from '@client/hooks/useInterviewItems'
import { todayISO, addDaysISO, formatMinutes } from '@client/lib/date'
import { readinessBand } from '@client/lib/readiness'
import { computeStreaks, minutesByDay, heatmapWeeks } from '@client/lib/streaks'
import {
  Panel, Gauge, ComponentBar, MinutesChart, Heatmap, SplitBar, Metric,
} from '@client/components/stats/charts'
import { cn } from '@client/lib/utils'

const RANGES = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export default function Stats() {
  const today = todayISO()
  const [range, setRange] = useState(30)

  const { data: settings } = useSettings()
  const goalMinutes = Math.round(readSetting(settings, 'dailyStudyGoalHours') * 60)

  const { data: sessions = [] } = useStudySessions({ from: addDaysISO(today, -400), to: today })
  const { data: tasks = [] } = useTasks({ from: addDaysISO(today, -400), to: today })
  const { data: revisions = [] } = useRevisions()
  const { data: reflections = [] } = useReflections()
  const { data: interviewStats } = useInterviewStats()

  /** A day counts as active if you logged focus time or completed a task. */
  const activeDays = useMemo(() => {
    const days = new Set<string>()
    for (const s of sessions as any[]) if (s.minutes > 0) days.add(s.date)
    for (const t of tasks as any[]) if (t.status === 'COMPLETED') days.add(t.date)
    return [...days]
  }, [sessions, tasks])

  const streaks = useMemo(() => computeStreaks(activeDays, today), [activeDays, today])

  const readiness = useMemo(() => {
    if (!interviewStats?.byTopic) return { score: null, components: [], eligibleWeight: 0, weakest: null }
    const byTopic = interviewStats.byTopic as Record<string, { total: number; revised: number }>
    const totalItems = Object.values(byTopic).reduce((s, t) => s + t.total, 0)
    const totalRevised = Object.values(byTopic).reduce((s, t) => s + t.revised, 0)

    // Simple readiness: items logged + revision discipline + consistency
    const components = [
      {
        key: 'coverage', label: 'Items logged', weight: 30,
        value: totalItems > 0 ? Math.min(totalItems / 50, 1) : null,
        detail: totalItems > 0 ? `${totalItems} items across all topics` : 'No items logged',
      },
      {
        key: 'revision', label: 'Revision discipline', weight: 30,
        value: revisions.length > 0
          ? 1 - (revisions as any[]).filter(r => r.nextDueDate < today).length / revisions.length
          : null,
        detail: revisions.length > 0
          ? `${(revisions as any[]).filter(r => r.nextDueDate >= today).length}/${revisions.length} cards on schedule`
          : 'No revision cards',
      },
      {
        key: 'consistency', label: 'Consistency', weight: 40,
        value: activeDays.length > 0 ? Math.min(streaks.current / 14, 1) : null,
        detail: activeDays.length > 0 ? `${streaks.current} day streak` : 'No activity',
      },
    ]
    const eligible = components.filter(c => c.value !== null)
    const eligibleWeight = eligible.reduce((s, c) => s + c.weight, 0)
    const score = eligibleWeight > 0
      ? Math.round((100 * eligible.reduce((s, c) => s + c.weight * (c.value as number), 0)) / eligibleWeight)
      : null
    const weakest = eligible.length > 0
      ? eligible.reduce((lo, c) => ((c.value as number) < (lo.value as number) ? c : lo))
      : null
    return { score, components, eligibleWeight, weakest }
  }, [interviewStats, revisions, activeDays, streaks, today])

  const band = readinessBand(readiness.score)

  const minutes = useMemo(
    () => minutesByDay(sessions as any, today, range),
    [sessions, today, range]
  )

  const totalMinutes = minutes.reduce((s, d) => s + d.minutes, 0)
  const activeInRange = minutes.filter(d => d.minutes > 0).length
  const avgPerActiveDay = activeInRange ? Math.round(totalMinutes / activeInRange) : 0

  const heat = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions as any[]) {
      map.set(s.date, (map.get(s.date) ?? 0) + (s.minutes || 0))
    }
    return { weeks: heatmapWeeks(map, today, 26), max: Math.max(...map.values(), 1) }
  }, [sessions, today])

  // Task throughput over the selected range
  const taskStats = useMemo(() => {
    const from = addDaysISO(today, -(range - 1))
    const inRange = (tasks as any[]).filter(t => t.date >= from && t.date <= today)
    const done = inRange.filter(t => t.status === 'COMPLETED').length

    // Estimate accuracy is only meaningful for tasks you actually tracked time on.
    // Including untouched tasks would add their estimate with no actual, making
    // every week look like it came in comfortably under estimate.
    const tracked = inRange.filter(t => (t.actualMinutes || 0) > 0)
    const estimated = tracked.reduce((s, t) => s + (t.estimatedMinutes || 0), 0)
    const actual = tracked.reduce((s, t) => s + (t.actualMinutes || 0), 0)

    return {
      total: inRange.length,
      done,
      rate: inRange.length ? Math.round((done / inRange.length) * 100) : 0,
      trackedCount: tracked.length,
      estimated,
      actual,
      byPriority: ['P1', 'P2', 'P3', 'P4'].map((p, i) => ({
        label: p,
        value: inRange.filter(t => t.priority === p).length,
        color: ['var(--ev-red)', 'var(--ev-orange)', 'var(--ev-yellow)', 'var(--ev-teal)'][i],
      })).filter(s => s.value > 0),
    }
  }, [tasks, today, range])

  const moodTrend = useMemo(() => {
    const recent = (reflections as any[])
      .filter(r => r.date >= addDaysISO(today, -(range - 1)))
      .sort((a, b) => a.date.localeCompare(b.date))
    if (recent.length === 0) return null
    const avg = recent.reduce((s, r) => s + (r.mood || 0), 0) / recent.length
    return { entries: recent, avg }
  }, [reflections, today, range])

  return (
    <div className="h-full overflow-y-auto pr-1">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Stats</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Consistency, throughput, and how ready you actually are.
          </p>
        </div>

        <div className="flex gap-1 rounded-lg bg-surface-2 p-1 ring-1 ring-border">
          {RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11.5px] font-medium transition',
                range === r.days ? 'text-white' : 'text-muted-foreground hover:text-foreground'
              )}
              style={range === r.days ? { background: 'var(--grad-selected)' } : undefined}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top metrics */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Metric
          icon={Flame}
          label="Current streak"
          value={streaks.current === 1 ? '1 day' : `${streaks.current} days`}
          sub={streaks.current > 0 ? 'keep it alive' : 'log focus time today'}
          accent={streaks.current > 0}
        />
        <Metric icon={Trophy} label="Longest streak" value={`${streaks.longest} days`} sub="personal best" />
        <Metric
          icon={Timer}
          label={`Focus time · ${range}d`}
          value={formatMinutes(totalMinutes)}
          sub={
            avgPerActiveDay
              ? `${formatMinutes(avgPerActiveDay)}/active day vs ${goalMinutes}m goal`
              : 'no sessions yet'
          }
        />
        <Metric
          icon={CalendarCheck}
          label="Active days"
          value={`${activeInRange}/${range}`}
          sub={`${streaks.totalActiveDays} all time`}
        />
      </div>

      {/* Readiness */}
      <div className="mb-3 grid gap-3 lg:grid-cols-[300px_1fr]">
        <Panel title="Interview readiness" hint={`Weighted over ${readiness.eligibleWeight} eligible points`}>
          <Gauge
            value={readiness.score}
            label="score"
            caption={band.label}
            color={band.color}
          />
          {readiness.score === null && (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
              Log a DSA problem, a system design topic, or an HR story and the score appears.
            </p>
          )}
          {readiness.weakest && (
            <p className="mt-3 rounded-lg bg-surface-3 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Biggest gap is <span className="font-medium text-foreground">{readiness.weakest.label}</span>.
              {' '}{readiness.weakest.detail}.
            </p>
          )}
        </Panel>

        <Panel
          title="Score breakdown"
          hint="Components with no data are excluded rather than counted as zero"
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            {readiness.components.map(c => (
              <ComponentBar
                key={c.key}
                label={c.label}
                value={c.value}
                weight={c.weight}
                detail={c.detail}
                isWeakest={readiness.weakest?.key === c.key && (c.value ?? 1) < 1}
              />
            ))}
          </div>
        </Panel>
      </div>

      {/* Focus time */}
      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Focus minutes" hint={`Last ${range} days`}>
          <MinutesChart data={minutes} />
        </Panel>

        <Panel title="Activity" hint="Last 26 weeks of focus time">
          <Heatmap weeks={heat.weeks} max={heat.max} />
        </Panel>
      </div>

      {/* Throughput */}
      <div className="mb-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Task completion" hint={`Last ${range} days`}>
          <div className="flex items-baseline gap-2">
            <span className="text-[30px] font-semibold leading-none tabular-nums">{taskStats.rate}%</span>
            <span className="text-[11.5px] text-muted-foreground">
              {taskStats.done} of {taskStats.total} done
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${taskStats.rate}%`, background: 'var(--grad-selected)' }}
            />
          </div>

          {taskStats.actual > 0 && (
            <div className="mt-4 space-y-1 border-t border-border pt-3 text-[11.5px]">
              <p className="pb-1 text-[10.5px] text-muted-foreground">
                Across {taskStats.trackedCount} task{taskStats.trackedCount === 1 ? '' : 's'} with tracked time
              </p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated</span>
                <span className="tabular-nums">{formatMinutes(taskStats.estimated)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actually spent</span>
                <span className="tabular-nums">{formatMinutes(taskStats.actual)}</span>
              </div>
              {/* Only compare when there is an estimate to compare against. */}
              {taskStats.estimated > 0 && (
                <p className="pt-1 text-[10.5px] text-muted-foreground">
                  {taskStats.actual > taskStats.estimated
                    ? `Running ${Math.round((taskStats.actual / taskStats.estimated - 1) * 100)}% over estimate.`
                    : `Coming in ${Math.round((1 - taskStats.actual / taskStats.estimated) * 100)}% under estimate.`}
                </p>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Tasks by priority" hint={`Last ${range} days`}>
          <SplitBar segments={taskStats.byPriority} total={taskStats.total} />
        </Panel>

        <Panel title="Interview items" hint="Across all topics, all time">
          {interviewStats?.totalItems ? (
            <SplitBar
              segments={Object.entries(interviewStats.byTopic as Record<string, { total: number }>)
                .map(([topic, v], i) => ({
                  label: topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                  value: v.total,
                  color: ['var(--ev-blue)', 'var(--ev-purple)', 'var(--ev-green)', 'var(--ev-orange)', 'var(--ev-teal)', 'var(--ev-pink)'][i % 6],
                }))
                .filter(s => s.value > 0)}
              total={interviewStats.totalItems}
            />
          ) : (
            <p className="py-6 text-center text-[12px] text-muted-foreground">No items yet.</p>
          )}
        </Panel>
      </div>

      {/* Interview progress per topic */}
      <div className="mb-3">
        <InterviewProgress settings={settings} today={today} />
      </div>

      {/* Mood */}
      <div className="grid gap-3 pb-2 lg:grid-cols-2">
        <Panel title="Mood" hint={moodTrend ? `Average ${moodTrend.avg.toFixed(1)} of 5` : 'From daily reflections'}>
          {!moodTrend ? (
            <p className="py-6 text-center text-[12px] text-muted-foreground">
              No reflections in this range yet.
            </p>
          ) : (
            <div className="flex h-[90px] items-end gap-[3px]">
              {moodTrend.entries.map(r => (
                <div
                  key={r.date}
                  title={`${r.date}: mood ${r.mood}/5`}
                  className="flex-1 rounded-sm bg-primary/70 transition hover:bg-primary"
                  style={{ height: `${(r.mood / 5) * 100}%` }}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Revision cards" hint="Spaced repetition health">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex-1 text-[11.5px] text-muted-foreground">On schedule</span>
              <span className="text-[12px] font-medium tabular-nums">
                {(revisions as any[]).filter(r => r.nextDueDate > today).length}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex-1 text-[11.5px] text-muted-foreground">Due today</span>
              <span className="text-[12px] font-medium tabular-nums text-[var(--ev-orange)]">
                {(revisions as any[]).filter(r => r.nextDueDate <= today).length}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex-1 text-[11.5px] text-muted-foreground">Total cards</span>
              <span className="text-[12px] font-medium tabular-nums">{revisions.length}</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ============================================================= Interview Progress */

const TOPIC_COLORS = [
  'var(--ev-blue)', 'var(--ev-purple)', 'var(--ev-green)',
  'var(--ev-orange)', 'var(--ev-teal)', 'var(--ev-pink)',
]

function InterviewProgress({
  settings, today,
}: { settings: Record<string, string> | undefined; today: string }) {
  const { data: stats } = useInterviewStats()
  if (!stats?.byTopic) return null

  const byTopic = stats.byTopic as Record<string, { total: number; today: number; month: number; revised: number }>
  const topics = Object.keys(byTopic)
  if (topics.length === 0) return null

  // Parse targets from settings
  let targets: Record<string, { daily: number; monthly: number }> = {}
  try { targets = settings?.interviewTargets ? JSON.parse(settings.interviewTargets) : {} } catch {}

  const monthLabel = new Date(today + 'T00:00:00')
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <Panel title="Interview progress" hint={`Today and ${monthLabel}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Daily progress */}
        <div>
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Today
          </p>
          <div className="space-y-2.5">
            {topics.map((topic, i) => {
              const t = byTopic[topic]
              const target = targets[topic]?.daily ?? 2
              const pct = target > 0 ? Math.min((t.today / target) * 100, 100) : 0
              const done = t.today >= target
              return (
                <div key={topic}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-medium">
                      {topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    <span className={cn('text-[11px] tabular-nums', done ? 'text-[var(--ev-green)] font-medium' : 'text-muted-foreground')}>
                      {t.today}/{target}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: done ? 'var(--ev-green)' : TOPIC_COLORS[i % TOPIC_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Monthly progress */}
        <div>
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            This month
          </p>
          <div className="space-y-2.5">
            {topics.map((topic, i) => {
              const t = byTopic[topic]
              const target = targets[topic]?.monthly ?? 30
              const pct = target > 0 ? Math.min((t.month / target) * 100, 100) : 0
              const done = t.month >= target
              return (
                <div key={topic}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-medium">
                      {topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    <span className={cn('text-[11px] tabular-nums', done ? 'text-[var(--ev-green)] font-medium' : 'text-muted-foreground')}>
                      {t.month}/{target}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: done ? 'var(--ev-green)' : TOPIC_COLORS[i % TOPIC_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Panel>
  )
}
