import { motion } from 'motion/react'
import { cn } from '@client/lib/utils'
import { dowLabels, PRIORITY_COLOR, toISO } from '@client/lib/date'

interface Props {
  cells: { date: Date; iso: string; day: number; inMonth: boolean }[]
  tasksByDate: Record<string, any[]>
  selected: string
  onSelect: (iso: string) => void
  mondayFirst?: boolean
}

export default function MonthGrid({ cells, tasksByDate, selected, onSelect, mondayFirst }: Props) {
  const today = toISO(new Date())

  return (
    <div className="flex min-h-0 flex-col">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-2 px-0.5 pb-2">
        {dowLabels(mondayFirst).map(d => (
          <div key={d} className="text-[11px] font-medium text-muted-foreground">
            <span className="hidden lg:inline">{d}</span>
            <span className="lg:hidden">{d.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-2 overflow-y-auto scrollbar-none">
        {cells.map(cell => {
          const tasks = tasksByDate[cell.iso] ?? []
          const isSelected = cell.iso === selected
          const isToday = cell.iso === today

          return (
            <button
              key={cell.iso}
              onClick={() => onSelect(cell.iso)}
              className={cn(
                'group relative flex min-h-[92px] flex-col items-start gap-1.5 overflow-hidden rounded-xl p-2.5 text-left transition-colors duration-150',
                isSelected
                  ? 'text-white ring-0'
                  : 'bg-surface-2 ring-1 ring-border hover:bg-surface-3',
                !cell.inMonth && !isSelected && 'opacity-45',
                isToday && !isSelected && 'ring-primary/55'
              )}
              style={isSelected ? { background: 'var(--grad-selected)' } : undefined}
            >
              <span
                className={cn(
                  'text-[15px] font-semibold leading-none tabular-nums',
                  !isSelected && (cell.inMonth ? 'text-foreground' : 'text-muted-foreground')
                )}
              >
                {cell.day}
              </span>

              <div className="flex w-full flex-col gap-1">
                {tasks.slice(0, 3).map(t => (
                  <div key={t.id} className="flex w-full items-center gap-1.5">
                    <span
                      className="h-2.5 w-[3px] shrink-0 rounded-full"
                      style={{
                        background: isSelected
                          ? 'rgba(255,255,255,0.85)'
                          : PRIORITY_COLOR[t.priority] ?? 'var(--ev-teal)',
                      }}
                    />
                    <span
                      className={cn(
                        'truncate text-[10.5px] leading-tight',
                        isSelected ? 'text-white/90' : 'text-muted-foreground',
                        t.status === 'COMPLETED' && 'line-through opacity-60'
                      )}
                    >
                      {t.title}
                    </span>
                  </div>
                ))}
                {tasks.length > 3 && (
                  <span className={cn('text-[10px]', isSelected ? 'text-white/70' : 'text-muted-foreground')}>
                    +{tasks.length - 3} more
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
