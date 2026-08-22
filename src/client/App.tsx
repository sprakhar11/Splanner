import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import IconRail from './components/layout/IconRail'
import TopBar from './components/layout/TopBar'
import FocusDock from './components/focus/FocusDock'
import SessionJournalSheet from './components/focus/SessionJournalSheet'
import CommandPalette from './components/palette/CommandPalette'
import { ToastProvider } from './components/ui/toast'
import { CommandPaletteProvider } from './hooks/useCommandPalette'
import { FocusTimerProvider } from './hooks/useFocusTimer'
import { PictureInPictureProvider } from './hooks/usePictureInPicture'
import { useReminders } from './hooks/useReminders'
import { useAppearance } from './hooks/useAppearance'
import Dashboard from './pages/Dashboard'
import Planner from './pages/Planner'
import Journal from './pages/Journal'
import Revise from './pages/Revise'
import Stats from './pages/Stats'
import InterviewPrep from './pages/InterviewPrep'
import Reflection from './pages/Reflection'
import Settings from './pages/Settings'
import Life from './pages/Life'
import Habits from './pages/Habits'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

const SUBTITLES: Record<string, string> = {
  '/': "Here's what's on your agenda today.",
  '/planner': 'Plan your day and keep the queue moving.',
  '/journal': 'Capture what you learn while it is fresh.',
  '/revise': 'Review what is due before it fades.',
  '/stats': 'Track consistency and interview readiness.',
  '/interview': 'DSA, system design, LLD, and behavioural prep.',
  '/habits': 'Tend the garden. Small things, repeated.',
  '/life': 'Your life in weeks. Make them count.',
  '/reflection': 'Close the day with a short review.',
  '/settings': 'Personalise Splanner and manage your data.',
}

function Shell() {
  const location = useLocation()
  useAppearance()
  useReminders()

  return (
    <div className="flex h-screen overflow-hidden bg-background p-3">
      <IconRail />

      {/* Inset panel */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
        <div className="shrink-0 px-5 pt-4">
          <TopBar subtitle={SUBTITLES[location.pathname]} />
        </div>

        {/* data-private: blurred when the rail's privacy toggle is on. Scoped to
            the routed content so the rail and top bar stay sharp and usable. */}
        <div data-private className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full"
            >
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="/revise" element={<Revise />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/interview" element={<InterviewPrep />} />
                <Route path="/reflection" element={<Reflection />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/habits" element={<Habits />} />
                <Route path="/life" element={<Life />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <FocusDock />
      <SessionJournalSheet />
      <CommandPalette />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          {/* PiP wraps the timer because start() floats the clock while the
              click that triggered it still counts as user activation. */}
          <PictureInPictureProvider>
            <FocusTimerProvider>
              <CommandPaletteProvider>
                <Shell />
              </CommandPaletteProvider>
            </FocusTimerProvider>
          </PictureInPictureProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
