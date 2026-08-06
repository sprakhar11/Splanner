export const DAILY_QUOTES = [
  "The only way to do great work is to love what you do.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "It does not matter how slowly you go as long as you do not stop.",
  "Believe you can and you're halfway there.",
  "The secret of getting ahead is getting started.",
  "Quality is not an act, it is a habit.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't watch the clock; do what it does. Keep going.",
  "Everything you've ever wanted is on the other side of fear.",
  "Discipline is the bridge between goals and accomplishment.",
  "Your limitation—it's only your imagination.",
]

export function getDailyQuote(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]
}

export const SRS_INTERVALS = [0, 1, 3, 7, 14, 30, 90]
