import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '@client/hooks/useTasks'
import { useSettings } from '@client/hooks/useSettings'
import { useReflections } from '@client/hooks/useAnalytics'
import { useToast } from '@client/components/ui/toast'
import { readSetting, isTabEnabled } from '@client/lib/settings'
import { useGarden } from '@client/hooks/useHabits'
import { todayISO, addDaysISO, timeLabel, relativeTime } from '@client/lib/date'

const FIRED_KEY = 'splanner.firedReminders'
const POLL_MS = 30_000
/** Local hour after which an unwritten reflection is nudged. */
const REFLECTION_NUDGE_HOUR = 20
/** Earlier than the reflection nudge: a habit can still be done at 8pm. */
const HABIT_NUDGE_HOUR = 19

/** Reminders already surfaced, so a re-render or refresh does not re-alert. */
function loadFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveFired(map: Record<string, number>) {
  // Keep the ledger small: drop anything older than a week.
  const cutoff = Date.now() - 7 * 86_400_000
  const pruned = Object.fromEntries(Object.entries(map).filter(([, at]) => at > cutoff))
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(pruned))
  } catch {
    /* storage unavailable — reminders still fire in-session */
  }
}

/** Best-effort OS notification. Silently no-ops when permission was never granted. */
function notifyBrowser(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    new Notification(title, { body, tag: title })
  } catch {
    /* some browsers throw when constructing without a service worker */
  }
}

/**
 * Polls the local task list and surfaces two things `reminderAt`/`deadline` were
 * always meant to drive but nothing consumed: reminder alerts and overdue warnings.
 */
export function useReminders() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { data: settings } = useSettings()

  // Watch a window around today so reminders set for tomorrow are already in cache.
  const { data: tasks = [] } = useTasks({
    from: addDaysISO(todayISO(), -1),
    to: addDaysISO(todayISO(), 1),
  })

  const firedRef = useRef<Record<string, number>>(loadFired())
  const tasksRef = useRef<any[]>(tasks)
  tasksRef.current = tasks

  // Read through a ref so toggling a setting does not restart the interval.
  const prefsRef = useRef({
    osNotifications: true, taskReminders: true, overdueAlerts: true,
    reflectionNudge: true, habitNudge: true,
  })
  prefsRef.current = {
    osNotifications: readSetting(settings, 'notificationsEnabled'),
    taskReminders: readSetting(settings, 'taskReminders'),
    overdueAlerts: readSetting(settings, 'revisionReminders'),
    reflectionNudge: readSetting(settings, 'reflectionReminder'),
    // Also off when the tab itself is disabled: no nudging about a hidden feature.
    habitNudge: readSetting(settings, 'habitReminders') && isTabEnabled(settings, 'habit'),
  }

  const { data: reflections = [] } = useReflections()
  const reflectionsRef = useRef<any[]>(reflections)
  reflectionsRef.current = reflections

  const { habits, today: habitToday } = useGarden()
  const habitsRef = useRef(habits)
  habitsRef.current = habits
  const habitTodayRef = useRef(habitToday)
  habitTodayRef.current = habitToday

  useEffect(() => {
    // If the setting says notifications are on but the browser was never asked,
    // request permission on first load. This covers the case where the default
    // seed has notificationsEnabled: true but the user never visited Settings.
    if (prefsRef.current.osNotifications) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [])

  useEffect(() => {
    const sweep = () => {
      const prefs = prefsRef.current
      const now = Date.now()
      const fired = firedRef.current
      let changed = false

      for (const t of tasksRef.current) {
        if (t.status === 'COMPLETED') continue

        // Reminder due
        if (prefs.taskReminders && t.reminderAt && t.reminderAt <= now) {
          const key = `r:${t.id}:${t.reminderAt}`
          if (!fired[key]) {
            fired[key] = now
            changed = true
            toast({
              title: t.title,
              body: `Reminder set for ${timeLabel(t.reminderAt)}.`,
              tone: 'info',
              action: { label: 'Open planner', onClick: () => navigate('/planner') },
            })
            if (prefs.osNotifications) notifyBrowser('Splanner reminder', t.title)
          }
        }

        // Deadline passed
        if (prefs.overdueAlerts && t.deadline && t.deadline <= now) {
          const key = `d:${t.id}:${t.deadline}`
          if (!fired[key]) {
            fired[key] = now
            changed = true
            toast({
              title: `Overdue: ${t.title}`,
              body: `Deadline was ${relativeTime(t.deadline, now)}.`,
              tone: 'warning',
              action: { label: 'Open planner', onClick: () => navigate('/planner') },
            })
            if (prefs.osNotifications) notifyBrowser('Splanner overdue', t.title)
          }
        }
      }

      // Evening nudge to write today's reflection, once per day.
      if (prefs.reflectionNudge && new Date(now).getHours() >= REFLECTION_NUDGE_HOUR) {
        const day = todayISO()
        const key = `refl:${day}`
        const written = reflectionsRef.current.some(r => r.date === day)
        if (!written && !fired[key]) {
          fired[key] = now
          changed = true
          toast({
            title: 'Close out the day',
            body: 'Two lines on what you learned is enough to keep the streak.',
            tone: 'info',
            action: { label: 'Write reflection', onClick: () => navigate('/reflection') },
          })
          if (prefs.osNotifications) notifyBrowser('Splanner', 'Write today\'s reflection')
        }
      }

      // Evening nudge for habits still open, once per logical day.
      //
      // Keyed on the logical day rather than the wall clock, so someone with a
      // late boundary is not nudged about a day they have already finished, and
      // is not nudged twice when midnight passes mid-evening.
      if (prefs.habitNudge && new Date(now).getHours() >= HABIT_NUDGE_HOUR) {
        const day = habitTodayRef.current
        const key = `habit:${day}`
        const open = habitsRef.current.filter(h => h.state.todayStatus === null)
        if (open.length > 0 && !fired[key]) {
          fired[key] = now
          changed = true
          toast({
            title: open.length === 1
              ? `Still open: ${open[0].title}`
              : `${open.length} habits still open`,
            body: 'A short version still counts.',
            tone: 'info',
            action: { label: 'Open garden', onClick: () => navigate('/habits') },
          })
          if (prefs.osNotifications) {
            notifyBrowser('Splanner habits', `${open.length} still open today`)
          }
        }
      }

      if (changed) saveFired(fired)
    }

    sweep()
    const id = setInterval(sweep, POLL_MS)
    return () => clearInterval(id)
  }, [toast, navigate])
}

/** Asks for OS notification permission. Call from a user gesture (Settings toggle). */
export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported' as const
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}
