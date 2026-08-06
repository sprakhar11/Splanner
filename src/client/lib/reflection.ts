/**
 * Pure helpers for the reflection form.
 *
 * The app already tracks tasks completed and focus minutes, so a new entry is
 * seeded from real activity rather than asking the user to retype what the
 * database knows. An existing entry always wins, so revisiting a saved day
 * never silently overwrites what was written.
 */

export type DayActuals = {
  /** Focus minutes logged on the day. */
  minutes: number
  /** Same figure in hours, rounded to one decimal for the form. */
  hours: number
  /** Tasks marked COMPLETED on the day. */
  completed: number
}

export type ReflectionForm = {
  tasksCompletedCount: number
  hoursStudied: number
  problemsSolvedCount: number
  mood: number
  learnedSummary: string
  struggledSummary: string
  gratitude: string
}

export const DEFAULT_MOOD = 3

/** Sums the day's tracked activity. */
export function dayActuals(
  sessions: { date: string; minutes?: number | null }[],
  tasks: { date: string; status?: string }[],
  date: string
): DayActuals {
  const minutes = sessions
    .filter(s => s.date === date)
    .reduce((sum, s) => sum + (s.minutes || 0), 0)

  const completed = tasks
    .filter(t => t.date === date && t.status === 'COMPLETED')
    .length

  return { minutes, hours: Math.round((minutes / 60) * 10) / 10, completed }
}

/**
 * Builds the form state for a day. A saved entry is used verbatim, including
 * legitimate zeros; only a missing entry falls back to tracked activity.
 */
export function initialReflectionForm(
  existing: Partial<ReflectionForm> | null | undefined,
  actuals: DayActuals
): ReflectionForm {
  return {
    tasksCompletedCount: existing?.tasksCompletedCount ?? actuals.completed,
    hoursStudied: existing?.hoursStudied ?? actuals.hours,
    problemsSolvedCount: existing?.problemsSolvedCount ?? 0,
    mood: existing?.mood ?? DEFAULT_MOOD,
    learnedSummary: existing?.learnedSummary ?? '',
    struggledSummary: existing?.struggledSummary ?? '',
    gratitude: existing?.gratitude ?? '',
  }
}

/** True when the numeric fields already match tracked activity. */
export function matchesActuals(form: ReflectionForm, actuals: DayActuals) {
  return Number(form.tasksCompletedCount) === actuals.completed
    && Number(form.hoursStudied) === actuals.hours
}

/** Coerces the form into the payload shape the API expects. */
export function toReflectionPayload(date: string, form: ReflectionForm) {
  return {
    date,
    tasksCompletedCount: Number(form.tasksCompletedCount) || 0,
    hoursStudied: Number(form.hoursStudied) || 0,
    problemsSolvedCount: Number(form.problemsSolvedCount) || 0,
    mood: Number(form.mood) || DEFAULT_MOOD,
    learnedSummary: form.learnedSummary,
    struggledSummary: form.struggledSummary,
    gratitude: form.gratitude,
  }
}
