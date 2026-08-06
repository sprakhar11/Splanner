import { motion } from 'motion/react'
import { Button } from './button'

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-4 rounded-full bg-secondary p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-[280px] mb-4">{description}</p>
      )}
      {action && (
        <Button size="sm" onClick={action.onClick}>{action.label}</Button>
      )}
    </motion.div>
  )
}
