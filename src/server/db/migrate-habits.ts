/**
 * Creates the habit tables. Runs at boot, idempotent.
 *
 * The project does not apply Drizzle migrations at runtime — `migrate-interview.ts`
 * and `ensureRolloverTable()` both hand-roll `CREATE TABLE IF NOT EXISTS`. This
 * follows that pattern, which is what makes the feature appear on an existing
 * database without anyone running a migration command.
 */
import { sqlite } from './connection'

export function ensureHabitTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      plant_type TEXT NOT NULL DEFAULT 'OAK',
      color TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  // The upsert in the log endpoint depends on this conflict target, so it is not
  // merely a data-integrity nicety.
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS habit_logs_habit_date_idx
      ON habit_logs (habit_id, date)
  `)

  // Reading a habit always means reading its logs.
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS habit_logs_habit_idx ON habit_logs (habit_id)
  `)
}
