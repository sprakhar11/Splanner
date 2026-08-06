import { motion } from 'motion/react'
import { Checkbox } from '@client/components/ui'
import { cn } from '@client/lib/utils'
import { AlertCircle } from 'lucide-react'

interface TaskItemProps {
  task: any
  isFocused?: boolean
  onToggle: (id: string, completed: boolean) => void
  onSelect: (id: string) => void
}

const priorityStyles: Record<string, { dot: string; label: string }> = {
  P1: { dot: 'bg-red-500', label: 'Urgent' },
  P2: { dot: 'bg-orange-500', label: 'High' },
  P3: { dot: 'bg-yellow-500', label: 'Medium' },
  P4: { dot: 'bg-zinc-500', label: 'Low' },
}

export default function TaskItem({ task, isFocused, onToggle, onSelect }: TaskItemProps) {
  const isCompleted = task.status === 'COMPLETED'
  const isInProgress = task.status === 'IN_PROGRESS'
  const isOverdue = task.deadline && task.deadline < Date.now() && !isCompleted
  const priority = priorityStyles[task.priority] || priorityStyles.P4

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: isCompleted ? 0.55 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer',
        'transition-colors duration-150',
        isFocused
          ? 'border-ring bg-accent'
          : 'border-border hover:bg-accent hover:border-input',
        isInProgress && 'border-l-2 border-l-primary'
      )}
      onClick={() => onSelect(task.id)}
    >
      <div onClick={(e) => { e.stopPropagation(); onToggle(task.id, !isCompleted) }}>
        <Checkbox checked={isCompleted} aria-label={`Mark ${task.title} as ${isCompleted ? 'incomplete' : 'complete'}`} />
      </div>

      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', priority.dot)}
        title={`${task.priority} — ${priority.label}`}
      />

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', isCompleted && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
      </div>

      {isOverdue && (
        <span className="flex items-center gap-1 text-xs text-destructive font-medium shrink-0">
          <AlertCircle className="h-3 w-3" />
          Overdue
        </span>
      )}

      {task.estimatedMinutes && (
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {task.actualMinutes ? `${task.actualMinutes}/` : ''}{task.estimatedMinutes}m
        </span>
      )}
    </motion.div>
  )
}
