import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Brain, CheckCircle2, Clock, Flame, Target } from 'lucide-react'
import { useTasks } from '@client/hooks/useTasks'
import { useRevisionsDue } from '@client/hooks/useRevisions'
import { useSettings } from '@client/hooks/useSettings'
import { getDailyQuote } from '@client/lib/constants'
import { PRIORITY_COLOR, toISO } from '@client/lib/date'
import { cn } from '@client/lib/utils'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' as const } },
}

function StatCard({
  icon: Icon, label, value, hint, accent,
}: {
  icon: React.ComponentType<any>; label: string; value: string | number; hint?: string; accent?: boolean
}) {
  return (
    <motion.div
      variants={item}
      className={cn(
        'rounded-xl p-4 ring-1 transition',
        accent ? 'ring-primary/40' : 'ring-border',
      )}
      style={{ background: accent ? 'var(--grad-selected)' : 'var(--surface-2)' }}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5', accent ? 'text-white/80' : 'text-muted-foreground')} />
        <p className={cn('text-[11.5px]', accent ? 'text-white/80' : 'text-muted-foreground')}>{label}</p>
      </div>
      <p className={cn('mt-2 text-[26px] font-semibold leading-none tabular-nums tracking-tight', accent && 'text-white')}>
        {value}
      </p>
      {hint && (
        <p className={cn('mt-1.5 text-[11px]', accent ? 'text-white/70' : 'text-muted-foreground')}>{hint}</p>
      )}
    </motion.div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const today = toISO(new Date())
  const { data: tasks = [] } = useTasks({ from: today, to: today })
  const { data: due = [] } = useRevisionsDue()
  const { data: settings } = useSettings()

  const goal = Number(settings?.dailyStudyGoalHours ?? 4)
  const total = tasks.length
  const done = tasks.filter((t: any) => t.status === 'COMPLETED').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const overdue = tasks.filter((t: any) => t.deadline && t.deadline < Date.now() && t.status !== 'COMPLETED').length
  const plannedMin = tasks.reduce((s: number, t: any) => s + (t.estimatedMinutes ?? 0), 0)

  const upcoming = tasks.filter((t: any) => t.status !== 'COMPLETED').slice(0, 5)

  return (
    <div className="h-full overflow-y-auto">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
        {/* Quote strip */}
        <motion.div
          variants={item}
          className="rounded-xl bg-surface-2 px-4 py-3 ring-1 ring-border"
        >
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{getDailyQuote()}</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Target} label="Today's tasks" value={total ? `${done}/${total}` : '—'} hint={`${pct}% complete`} />
          <StatCard icon={Brain} label="Revisions due" value={due.length} hint={due.length ? 'Review now' : 'Nothing scheduled'} accent={due.length > 0} />
          <StatCard icon={Flame} label="Overdue" value={overdue} hint={overdue ? 'Needs attention' : 'All clear'} />
          <StatCard icon={Clock} label="Planned" value={`${Math.round(plannedMin / 60 * 10) / 10}h`} hint={`Goal ${goal}h`} />
        </div>

        {/* Two-column */}
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          {/* Up next */}
          <motion.section variants={item} className="rounded-xl bg-surface-2 p-4 ring-1 ring-border">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold">Up next</h3>
              <button
                onClick={() => navigate('/planner')}
                className="flex items-center gap-1 text-[11.5px] text-muted-foreground transition hover:text-foreground"
              >
                Open planner <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-surface-3">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[12.5px] font-medium">
                  {total > 0 ? 'Everything done for today' : 'Nothing planned yet'}
                </p>
                <button
                  onClick={() => navigate('/planner')}
                  className="mt-2 text-[11.5px] text-primary transition hover:underline"
                >
                  {total > 0 ? 'Plan tomorrow' : 'Add your first task'}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map((t: any) => (
                  <div
                    key={t.id}
                    onClick={() => navigate('/planner')}
                    className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-3 px-3 py-2.5 ring-1 ring-transparent transition hover:ring-primary/35"
                  >
                    <span
                      className="h-6 w-[3px] shrink-0 rounded-full"
                      style={{ background: PRIORITY_COLOR[t.priority] ?? 'var(--ev-teal)' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium leading-tight">{t.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {t.priority} · {t.estimatedMinutes} min
                      </p>
                    </div>
                    {t.status === 'IN_PROGRESS' && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Active
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          {/* Progress ring + actions */}
          <motion.section variants={item} className="flex flex-col rounded-xl bg-surface-2 p-4 ring-1 ring-border">
            <h3 className="mb-3 text-[14px] font-semibold">Day progress</h3>

            <div className="flex flex-1 flex-col items-center justify-center py-2">
              <div className="relative grid h-[112px] w-[112px] place-items-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-3)" strokeWidth="9" />
                  <motion.circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="var(--primary)" strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - pct / 100) }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </svg>
                <div className="text-center">
                  <p className="text-[24px] font-semibold leading-none tabular-nums">{pct}%</p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">{done} of {total}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {due.length > 0 && (
                <button
                  onClick={() => navigate('/revise')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-white transition hover:opacity-90"
                  style={{ background: 'var(--grad-selected)' }}
                >
                  <Brain className="h-3.5 w-3.5" /> Review {due.length} cards
                </button>
              )}
              <button
                onClick={() => navigate('/reflection')}
                className="w-full rounded-lg bg-surface-3 px-3 py-2 text-[12px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                Write reflection
              </button>
            </div>
          </motion.section>
        </div>
      </motion.div>
    </div>
  )
}
