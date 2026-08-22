import { useMemo } from 'react'
import { Sheet } from '@client/components/ui'
import Plant from '@client/components/habits/Plant'
import { PLANT_LABELS, type PlantType } from '@client/components/habits/Plant'
import { STAGE_THRESHOLDS, type Stage, type Health } from '@client/lib/habits'
import { heatmapWeeks } from '@client/lib/streaks'
import type { HabitWithState } from '@client/hooks/useHabits'
import { cn } from '@client/lib/utils'

const WEEKS = 26

const STAGE_LABEL: Record<Stage, string> = {
  SEED: 'Seed',
  SPROUT: 'Sprout',
  SAPLING: 'Sapling',
  MATURE: 'Mature',
  BLOOMING: 'Blooming',
}

const HEALTH_COPY: Record<Health, string> = {
  THRIVING: 'Doing fine. Keep it up.',
  WILTED: 'A day or two missed. Easy to bring back.',
  DYING: 'Been a while. One completion turns this around.',
  DEAD: 'Long neglected — but the plant keeps its size, so nothing is lost.',
}

/** Heatmap buckets. Binary habits do not suit the generic intensity ramp. */
const COMPLETED_BUCKET = 4
const SKIPPED_BUCKET = 2

export default function HabitSheet({
  habit,
  today,
  onClose,
}: {
  habit: HabitWithState | null
  today: string
  onClose: () => void
}) {
  const weeks = useMemo(() => {
    if (!habit) return []
    const activity = new Map<string, number>()
    for (const log of habit.logs) {
      activity.set(log.date, log.status === 'COMPLETED' ? COMPLETED_BUCKET : SKIPPED_BUCKET)
    }
    return heatmapWeeks(activity, today, WEEKS)
  }, [habit, today])

  if (!habit) return null
  const { state } = habit

  return (
    <Sheet
      open={!!habit}
      onOpenChange={o => { if (!o) onClose() }}
      side="right"
      title={habit.title}
      subtitle={`${PLANT_LABELS[(habit.plantType as PlantType)] ?? habit.plantType} · ${STAGE_LABEL[state.stage]}`}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 shrink-0">
            <Plant
              plantType={habit.plantType}
              stage={state.stage}
              health={state.health}
              color={habit.color}
              className="h-full w-full"
            />
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {HEALTH_COPY[state.health]}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Streak" value={state.currentStreak} suffix="days" accent={state.currentStreak > 0} />
          <Stat label="Longest" value={state.longestStreak} suffix="days" />
          <Stat label="Total" value={state.totalCompletions} suffix="done" />
        </div>

        {/* Growth ladder. Size comes from total completions, so this bar only
            ever moves forward — that is the point of the design. */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="text-[12px] font-semibold">Growth</h4>
            <p className="text-[10.5px] text-muted-foreground">
              {state.toNextStage === null
                ? 'Fully grown'
                : `${state.toNextStage} more to ${nextStageLabel(state.stage)}`}
            </p>
          </div>
          <div className="space-y-1.5">
            {STAGE_THRESHOLDS.map(t => {
              const reached = state.totalCompletions >= t.min
              const current = state.stage === t.stage
              return (
                <div key={t.stage} className="flex items-center gap-2.5 text-[11px]">
                  <span
                    className={cn(
                      'w-16 shrink-0',
                      current ? 'font-semibold text-foreground' : reached ? 'text-muted-foreground' : 'text-muted-foreground/50'
                    )}
                  >
                    {STAGE_LABEL[t.stage]}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                    {/* The next rung shows real partial progress. Filling it with
                        surface-3 made that progress invisible against its track. */}
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: reached
                          ? '100%'
                          : `${Math.min(100, (state.totalCompletions / Math.max(1, t.min)) * 100)}%`,
                        background: reached
                          ? 'var(--primary)'
                          : 'color-mix(in oklch, var(--primary) 40%, transparent)',
                      }}
                    />
                  </div>
                  <span className={cn('w-8 shrink-0 text-right tabular-nums', reached ? 'text-muted-foreground' : 'text-muted-foreground/50')}>
                    {t.min}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="text-[12px] font-semibold">Last {WEEKS} weeks</h4>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Swatch bucket={COMPLETED_BUCKET} /> done
              <Swatch bucket={SKIPPED_BUCKET} /> skipped
            </div>
          </div>
          <div className="flex gap-[3px] overflow-x-auto pb-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map(day => (
                  <div
                    key={day.date}
                    title={`${day.date}${day.value === COMPLETED_BUCKET ? ' · done' : day.value === SKIPPED_BUCKET ? ' · skipped' : ''}`}
                    className={cn('h-[9px] w-[9px] rounded-[2px]', day.inFuture && 'opacity-25')}
                    style={{ background: bucketColor(day.value) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  )
}

function nextStageLabel(current: Stage): string {
  const i = STAGE_THRESHOLDS.findIndex(t => t.stage === current)
  const next = STAGE_THRESHOLDS[i + 1]
  return next ? STAGE_LABEL[next.stage] : 'the top'
}

function bucketColor(value: number): string {
  if (value >= COMPLETED_BUCKET) return 'var(--primary)'
  if (value >= SKIPPED_BUCKET) return 'color-mix(in oklch, var(--primary) 35%, var(--surface-3))'
  return 'var(--surface-3)'
}

function Swatch({ bucket }: { bucket: number }) {
  return (
    <span
      className="inline-block h-[9px] w-[9px] rounded-[2px]"
      style={{ background: bucketColor(bucket) }}
    />
  )
}

function Stat({
  label, value, suffix, accent,
}: { label: string; value: number; suffix: string; accent?: boolean }) {
  return (
    <div
      className="rounded-xl p-2.5 ring-1 ring-border"
      style={{ background: accent ? 'var(--grad-selected)' : 'var(--surface-3)' }}
    >
      <p className={cn('text-[10.5px]', accent ? 'text-white/75' : 'text-muted-foreground')}>{label}</p>
      <p className={cn('mt-1 text-[20px] font-semibold leading-none tabular-nums', accent && 'text-white')}>
        {value}
      </p>
      <p className={cn('mt-1 text-[10px]', accent ? 'text-white/60' : 'text-muted-foreground')}>{suffix}</p>
    </div>
  )
}
