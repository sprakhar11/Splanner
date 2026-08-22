import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, MoreVertical, SkipForward, Eraser, Pencil, Archive, Flame } from 'lucide-react'
import Plant from '@client/components/habits/Plant'
import type { HabitWithState } from '@client/hooks/useHabits'
import type { Health } from '@client/lib/habits'
import { cn } from '@client/lib/utils'

const HEALTH_LABEL: Record<Health, string> = {
  THRIVING: 'Thriving',
  WILTED: 'Wilting',
  DYING: 'Struggling',
  DEAD: 'Neglected',
}

const HEALTH_TONE: Record<Health, string> = {
  THRIVING: 'text-[var(--ev-green)]',
  WILTED: 'text-[var(--ev-yellow)]',
  DYING: 'text-[var(--ev-orange)]',
  DEAD: 'text-muted-foreground',
}

const STAGE_LABEL: Record<string, string> = {
  SEED: 'Seed',
  SPROUT: 'Sprout',
  SAPLING: 'Sapling',
  MATURE: 'Mature',
  BLOOMING: 'Blooming',
}

/**
 * One habit in the garden.
 *
 * The whole card is not the toggle: tapping the plant opens the detail sheet,
 * and a distinct control marks the day. Making the entire surface a toggle meant
 * every attempt to inspect a habit logged a completion instead.
 */
export default function PlantCard({
  habit,
  onToggle,
  onSkip,
  onClear,
  onEdit,
  onArchive,
  onOpen,
}: {
  habit: HabitWithState
  onToggle: () => void
  onSkip: () => void
  onClear: () => void
  onEdit: () => void
  onArchive: () => void
  onOpen: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { state } = habit
  const done = state.todayStatus === 'COMPLETED'
  const skipped = state.todayStatus === 'SKIPPED'

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl p-4 ring-1 transition',
        done ? 'ring-primary/50' : 'ring-border hover:ring-input'
      )}
      style={{ background: done ? 'var(--grad-selected)' : 'var(--surface-2)' }}
    >
      {/* Menu. A visible control, not right-click only, so it is reachable by
          keyboard and on touch. */}
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-label={`Options for ${habit.title}`}
          aria-expanded={menuOpen}
          className={cn(
            'grid h-7 w-7 place-items-center rounded-md transition',
            done ? 'text-white/70 hover:bg-white/15 hover:text-white'
                 : 'text-muted-foreground opacity-0 hover:bg-surface-3 hover:text-foreground focus:opacity-100 group-hover:opacity-100'
          )}
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <>
            <button
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <div
              role="menu"
              className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-lg bg-popover py-1 shadow-xl ring-1 ring-border"
            >
              <MenuItem icon={SkipForward} onClick={() => { setMenuOpen(false); onSkip() }}>
                {skipped ? 'Already skipped' : 'Skip today'}
              </MenuItem>
              {state.todayStatus && (
                <MenuItem icon={Eraser} onClick={() => { setMenuOpen(false); onClear() }}>
                  Clear today
                </MenuItem>
              )}
              <MenuItem icon={Pencil} onClick={() => { setMenuOpen(false); onEdit() }}>
                Edit habit
              </MenuItem>
              <MenuItem icon={Archive} tone="danger" onClick={() => { setMenuOpen(false); onArchive() }}>
                Archive
              </MenuItem>
            </div>
          </>
        )}
      </div>

      {/* The plant opens the detail sheet. */}
      <button
        onClick={onOpen}
        aria-label={`${habit.title}. ${STAGE_LABEL[state.stage]}, ${HEALTH_LABEL[state.health]}. ${state.currentStreak} day streak. Open details.`}
        className="mx-auto h-24 w-24 shrink-0 rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <Plant
          plantType={habit.plantType}
          stage={state.stage}
          health={state.health}
          color={habit.color}
          className="h-full w-full"
        />
      </button>

      <div className="mt-2 min-w-0">
        <p className={cn('truncate text-[13px] font-semibold', done && 'text-white')}>
          {habit.title}
        </p>

        {/* Health in words, so colour is never the only signal. */}
        <div className="mt-0.5 flex items-center gap-2 text-[10.5px]">
          <span className={cn(done ? 'text-white/75' : HEALTH_TONE[state.health])}>
            {HEALTH_LABEL[state.health]}
          </span>
          <span className={done ? 'text-white/40' : 'text-muted-foreground/50'}>·</span>
          <span className={done ? 'text-white/75' : 'text-muted-foreground'}>
            {STAGE_LABEL[state.stage]}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <motion.button
          onClick={onToggle}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          aria-pressed={done}
          aria-label={done ? `Mark ${habit.title} not done today` : `Mark ${habit.title} done today`}
          className={cn(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold ring-1 transition',
            done
              ? 'bg-white/15 text-white ring-white/25 hover:bg-white/25'
              : skipped
                ? 'bg-surface-3 text-muted-foreground ring-border hover:text-foreground'
                : 'bg-surface-3 ring-border hover:bg-accent'
          )}
        >
          {done
            ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> Done</>
            : skipped
              ? <><SkipForward className="h-3.5 w-3.5" /> Skipped</>
              : 'Mark done'}
        </motion.button>

        <div
          className={cn(
            'flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold tabular-nums',
            done ? 'bg-white/15 text-white' : 'bg-surface-3 text-muted-foreground'
          )}
          title={`${state.currentStreak} day streak · longest ${state.longestStreak}`}
        >
          <Flame className={cn('h-3.5 w-3.5', state.currentStreak > 0 && !done && 'text-[var(--ev-orange)]')} />
          {state.currentStreak}
        </div>
      </div>
    </div>
  )
}

function MenuItem({
  children, icon: Icon, onClick, tone = 'default',
}: {
  children: React.ReactNode
  icon: React.ComponentType<any>
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition',
        tone === 'danger'
          ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
          : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </button>
  )
}
