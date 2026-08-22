import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Check } from 'lucide-react'
import Plant from '@client/components/habits/Plant'
import { useGarden, useLogHabit } from '@client/hooks/useHabits'
import { useSettings } from '@client/hooks/useSettings'
import { isTabEnabled } from '@client/lib/settings'
import { cn } from '@client/lib/utils'

/**
 * Today's habits, on the dashboard.
 *
 * A tracker you have to navigate to is a tracker you forget, which is the gap the
 * revision queue had for months. Each plant is tappable here, so the common case
 * — tick two things off on the way past — never needs the Habits tab at all.
 *
 * Renders nothing when the tab is disabled or nothing is planted.
 */
export default function HabitStrip() {
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const { habits, today } = useGarden()
  const log = useLogHabit()

  if (!isTabEnabled(settings, 'habit')) return null
  if (habits.length === 0) return null

  const done = habits.filter(h => h.state.todayStatus === 'COMPLETED').length

  return (
    <section className="rounded-xl bg-surface-2 p-4 ring-1 ring-border">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">
          Habits
          <span className="ml-2 text-[11.5px] font-normal text-muted-foreground tabular-nums">
            {done} of {habits.length} today
          </span>
        </h3>
        <button
          onClick={() => navigate('/habits')}
          className="flex items-center gap-1 text-[11.5px] text-muted-foreground transition hover:text-foreground"
        >
          Open garden <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {habits.map(h => {
          const isDone = h.state.todayStatus === 'COMPLETED'
          const skipped = h.state.todayStatus === 'SKIPPED'
          return (
            <motion.button
              key={h.id}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={() =>
                log.mutate({ id: h.id, date: today, status: isDone ? null : 'COMPLETED' })
              }
              aria-pressed={isDone}
              aria-label={
                isDone
                  ? `Mark ${h.title} not done today`
                  : `Mark ${h.title} done today. ${h.state.currentStreak} day streak.`
              }
              className={cn(
                'flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3 ring-1 transition',
                isDone ? 'ring-primary/50' : 'bg-surface-3 ring-border hover:ring-input'
              )}
              style={isDone ? { background: 'var(--grad-selected)' } : undefined}
            >
              <div className="h-8 w-8 shrink-0">
                <Plant
                  plantType={h.plantType}
                  stage={h.state.stage}
                  health={h.state.health}
                  color={h.color}
                  animate={false}
                  className="h-full w-full"
                />
              </div>
              <span className="min-w-0">
                <span className={cn('block max-w-[130px] truncate text-[12px] font-medium', isDone && 'text-white')}>
                  {h.title}
                </span>
                <span className={cn('block text-[10px]', isDone ? 'text-white/70' : 'text-muted-foreground')}>
                  {isDone
                    ? <><Check className="mr-0.5 inline h-2.5 w-2.5" strokeWidth={3} />done</>
                    : skipped
                      ? 'skipped'
                      : `${h.state.currentStreak}d streak`}
                </span>
              </span>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
