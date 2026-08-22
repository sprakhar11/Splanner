/**
 * The garden's daily line.
 *
 * Deterministic from the date rather than random, so it survives a reload and a
 * re-render without needing to be stored anywhere. Feed it the *logical* day and
 * it changes when the user's day changes, not at midnight.
 *
 * Unattributed on purpose. Habit-app quote lists are riddled with misattributions
 * and there is no reason to add to that.
 */

export const QUOTES = [
  'Small things, repeated, are the only things that compound.',
  'Consistency beats intensity. It is not close.',
  'The day you do not feel like it is the day that counts.',
  'You do not need a better plan. You need another repetition.',
  'Showing up badly still counts as showing up.',
  'Motivation follows action more often than it leads it.',
  'A streak is just a decision you stopped renegotiating.',
  'Two minutes today beats an hour you keep postponing.',
  'Progress is quiet. Notice it anyway.',
  'The habit is the goal. The outcome is a side effect.',
  'Miss once, it is an accident. Miss twice, it is a new habit.',
  'You are not behind. You are mid-run.',
  'Do the boring thing. It is the whole trick.',
  'Every day you begin again is a day you did not quit.',
  'Skip deliberately, never accidentally.',
  'The plant does not care how you feel about watering it.',
  'Start smaller than feels worthwhile.',
  'What you do most days matters more than what you do on your best one.',
  'Discipline is remembering what you want.',
  'A short session done is worth more than a long one planned.',
  'You can restart as many times as you need to.',
  'Tend it before it needs rescuing.',
  'Slow is fine. Stopped is the problem.',
  'The streak is not the point, but it helps.',
] as const

/**
 * Stable hash of a yyyy-MM-dd string.
 *
 * FNV-1a, which spreads sequential dates across the list far better than summing
 * character codes would — consecutive days should not land on adjacent quotes.
 */
function hashDate(iso: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < iso.length; i++) {
    h ^= iso.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The quote for a given logical day. Same day in, same quote out. */
export function quoteForDay(iso: string): string {
  return QUOTES[hashDate(iso) % QUOTES.length]
}
