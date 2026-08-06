import { Outlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation } from 'react-router-dom'

export default function MainContent() {
  const location = useLocation()

  return (
    <main className="flex-1 overflow-y-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
