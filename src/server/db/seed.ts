import { db } from './connection'
import { categories, settings } from './schema'
import { eq, count } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const DEFAULT_CATEGORIES = [
  { name: 'Work & Projects', color: 0xFFEF4444, iconName: 'briefcase', position: 0 },
  { name: 'DSA & Coding', color: 0xFF3B82F6, iconName: 'code', position: 1 },
  { name: 'System Design', color: 0xFFA855F7, iconName: 'layers', position: 2 },
  { name: 'Learning & Reading', color: 0xFF22C55E, iconName: 'book-open', position: 3 },
  { name: 'Health & Personal', color: 0xFFF59E0B, iconName: 'heart', position: 4 },
]

/** Keep in sync with DEFAULTS in src/client/lib/settings.ts. */
const DEFAULT_SETTINGS: Record<string, string> = {
  userName: 'Prakhar',
  theme: 'blue',
  darkMode: 'system', // system | light | dark
  fontScale: 'default', // default | large | extra-large
  dailyStudyGoalHours: '4',
  notificationsEnabled: 'true',
  taskReminders: 'true',
  revisionReminders: 'true',
  waterBreakReminders: 'true',
  reflectionReminder: 'true',
  weeklyPlanningPrompt: 'true',
  monthlyReviewPrompt: 'true',
  weekStartsMonday: 'false',
  pomodoroMinutes: '25',
  focusPopOut: 'true',
  rolloverHour: '0',
  disabledTabs: 'life,revise,reflection',
}

export function seedDatabase() {
  // Seed categories if none exist
  const [categoryCount] = db.select({ value: count() }).from(categories).all()
  if (categoryCount.value === 0) {
    console.log('[seed] Seeding default categories...')
    for (const cat of DEFAULT_CATEGORIES) {
      db.insert(categories).values({ id: randomUUID(), ...cat }).run()
    }
    console.log('[seed] 5 categories created.')
  }

  /**
   * Backfill any missing setting, rather than only seeding an empty table.
   *
   * Seeding on "table is empty" meant a key added in a later version never
   * reached an existing database — it only appeared once the user happened to
   * save the Settings page. The client fell back to its default so nothing
   * looked broken, but the stored config silently drifted from the model.
   * Existing values are never overwritten.
   */
  const existing = new Set(db.select().from(settings).all().map(r => r.key))
  const missing = Object.entries(DEFAULT_SETTINGS).filter(([key]) => !existing.has(key))

  if (missing.length > 0) {
    for (const [key, value] of missing) {
      db.insert(settings).values({ key, value }).run()
    }
    console.log(
      existing.size === 0
        ? `[seed] Default settings created (${missing.length}).`
        : `[seed] Backfilled ${missing.length} new setting(s): ${missing.map(([k]) => k).join(', ')}.`
    )
  }
}

export function restoreDefaultCategories() {
  // Delete all existing categories
  db.delete(categories).run()
  // Re-seed
  for (const cat of DEFAULT_CATEGORIES) {
    db.insert(categories).values({ id: randomUUID(), ...cat }).run()
  }
}
