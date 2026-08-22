import { sqlite, db } from '../db/connection'
import * as schema from '../db/schema'
import { ensureRolloverTable } from './day-rollover'
import path from 'path'
import fs from 'fs'

const BACKUP_DIR = path.resolve('data/backups')
const MAX_BACKUPS = 14

/**
 * Creates an atomic binary backup using VACUUM INTO.
 * Safe to call while the app is running (WAL mode).
 * Retains last 14 daily backups.
 */
export function performAutoBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  const today = new Date().toISOString().split('T')[0] // yyyy-MM-dd
  const backupPath = path.join(BACKUP_DIR, `splanner-${today}.db`)

  // Skip if today's backup already exists
  if (fs.existsSync(backupPath)) {
    console.log(`[backup] Today's backup already exists: ${backupPath}`)
    return
  }

  try {
    sqlite.exec(`VACUUM INTO '${backupPath}'`)
    console.log(`[backup] Binary backup created: ${backupPath}`)
  } catch (err) {
    console.error('[backup] Failed to create backup:', err)
    return
  }

  // Cleanup old backups
  cleanupOldBackups()
}

function cleanupOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('splanner-') && f.endsWith('.db'))
    .sort()
    .reverse() // newest first

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS)
    for (const file of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, file))
      console.log(`[backup] Deleted old backup: ${file}`)
    }
  }
}

/**
 * Export entire database as JSON (for manual backup / portability).
 */
export function exportAsJson(): string {
  const data = {
    // v2 added interviewItems, notifications and taskRollovers.
    // v3 adds habits and habitLogs.
    // Older files are still importable — every table is read with a presence check.
    version: 3,
    exportedAt: Date.now(),
    categories: db.select().from(schema.categories).all(),
    tasks: db.select().from(schema.tasks).all(),
    subtasks: db.select().from(schema.subtasks).all(),
    notes: db.select().from(schema.notes).all(),
    revisions: db.select().from(schema.revisionItems).all(),
    revisionHistory: db.select().from(schema.revisionHistory).all(),
    reflections: db.select().from(schema.reflections).all(),
    interviewItems: db.select().from(schema.interviewItems).all(),
    dsa: db.select().from(schema.dsaProblems).all(),
    systemDesign: db.select().from(schema.systemDesign).all(),
    lld: db.select().from(schema.lldDesigns).all(),
    hrStories: db.select().from(schema.hrStories).all(),
    studySessions: db.select().from(schema.studySessions).all(),
    notifications: db.select().from(schema.notifications).all(),
    taskRollovers: readTaskRollovers(),
    habits: db.select().from(schema.habits).all(),
    habitLogs: db.select().from(schema.habitLogs).all(),
    taskTags: db.select().from(schema.taskTags).all(),
    noteTags: db.select().from(schema.noteTags).all(),
    revisionItemTags: db.select().from(schema.revisionItemTags).all(),
    hrStoryTags: db.select().from(schema.hrStoryTags).all(),
    settings: db.select().from(schema.settings).all(),
  }
  return JSON.stringify(data, null, 2)
}

/**
 * The rollover log lives outside the Drizzle schema — day-rollover.ts creates it
 * with raw DDL on demand, so it may not exist yet on an older database.
 */
function readTaskRollovers(): any[] {
  try {
    return sqlite.prepare(
      'SELECT id, task_id, from_date, to_date, rolled_at FROM task_rollovers'
    ).all() as any[]
  } catch {
    return []
  }
}

/** Restores the rollover log, creating the table first if this database predates it. */
function writeTaskRollovers(rows: any[]) {
  if (!rows?.length) return
  ensureRolloverTable()
  const stmt = sqlite.prepare(
    `INSERT INTO task_rollovers (id, task_id, from_date, to_date, rolled_at)
     VALUES (?, ?, ?, ?, ?)`
  )
  for (const r of rows) {
    // Merge mode can collide on the autoincrement id; the log is append-only
    // history, so a duplicate is not worth failing the whole import over.
    try { stmt.run(r.id, r.task_id, r.from_date, r.to_date, r.rolled_at) } catch {}
  }
}

/**
 * Import JSON backup. mode = 'replace' wipes all data first; 'merge' upserts by ID.
 */
export function importFromJson(jsonStr: string, mode: 'replace' | 'merge' = 'replace') {
  const data = JSON.parse(jsonStr)

  if (!data.version || !data.exportedAt) {
    throw new Error('Invalid backup format: missing version or exportedAt')
  }

  sqlite.exec('BEGIN TRANSACTION')

  try {
    if (mode === 'replace') {
      // Delete all data (order matters for foreign keys)
      db.delete(schema.hrStoryTags).run()
      db.delete(schema.revisionItemTags).run()
      db.delete(schema.noteTags).run()
      db.delete(schema.taskTags).run()
      db.delete(schema.studySessions).run()
      // Before revisionItems and tasks: interview items point at both.
      db.delete(schema.interviewItems).run()
      db.delete(schema.revisionHistory).run()
      db.delete(schema.revisionItems).run()
      db.delete(schema.subtasks).run()
      db.delete(schema.notifications).run()
      // Logs before habits: the FK cascades, but being explicit keeps the order
      // meaningful if the cascade is ever dropped.
      db.delete(schema.habitLogs).run()
      db.delete(schema.habits).run()
      try { sqlite.exec('DELETE FROM task_rollovers') } catch {}
      db.delete(schema.reflections).run()
      db.delete(schema.dsaProblems).run()
      db.delete(schema.systemDesign).run()
      db.delete(schema.lldDesigns).run()
      db.delete(schema.hrStories).run()
      db.delete(schema.notes).run()
      db.delete(schema.tasks).run()
      db.delete(schema.categories).run()
      db.delete(schema.settings).run()
    }

    // Insert data (order matters for foreign keys)
    const insertBatch = (table: any, rows: any[]) => {
      if (rows && rows.length > 0) {
        for (const row of rows) {
          db.insert(table).values(row).onConflictDoUpdate({
            target: (table as any).id || (table as any).key,
            set: row,
          }).run()
        }
      }
    }

    // For tables with composite keys or no 'id', use simple insert with ignore
    const insertSimple = (table: any, rows: any[]) => {
      if (rows && rows.length > 0) {
        for (const row of rows) {
          try {
            db.insert(table).values(row).run()
          } catch {
            // Skip duplicates in merge mode
          }
        }
      }
    }

    if (data.categories) insertBatch(schema.categories, data.categories)
    if (data.settings) {
      for (const s of data.settings) {
        db.insert(schema.settings).values(s).onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: s.value },
        }).run()
      }
    }
    if (data.tasks) insertBatch(schema.tasks, data.tasks)
    if (data.subtasks) insertBatch(schema.subtasks, data.subtasks)
    if (data.notes) insertBatch(schema.notes, data.notes)
    if (data.revisions) insertBatch(schema.revisionItems, data.revisions)
    if (data.revisionHistory) insertBatch(schema.revisionHistory, data.revisionHistory)
    if (data.reflections) insertBatch(schema.reflections, data.reflections)
    // After tasks and revisionItems, since interview items reference both.
    // Absent from v1 exports, which is exactly the data those backups lost.
    if (data.interviewItems) insertBatch(schema.interviewItems, data.interviewItems)
    if (data.dsa) insertBatch(schema.dsaProblems, data.dsa)
    if (data.systemDesign) insertBatch(schema.systemDesign, data.systemDesign)
    if (data.lld) insertBatch(schema.lldDesigns, data.lld)
    if (data.hrStories) insertBatch(schema.hrStories, data.hrStories)
    if (data.studySessions) insertBatch(schema.studySessions, data.studySessions)
    if (data.notifications) insertBatch(schema.notifications, data.notifications)
    // Habits before their logs, which carry a FK to them.
    if (data.habits) insertBatch(schema.habits, data.habits)
    if (data.habitLogs) insertBatch(schema.habitLogs, data.habitLogs)
    if (data.taskRollovers) writeTaskRollovers(data.taskRollovers)

    // Junction tables (no primary key — simple insert)
    if (data.taskTags) insertSimple(schema.taskTags, data.taskTags)
    if (data.noteTags) insertSimple(schema.noteTags, data.noteTags)
    if (data.revisionItemTags) insertSimple(schema.revisionItemTags, data.revisionItemTags)
    if (data.hrStoryTags) insertSimple(schema.hrStoryTags, data.hrStoryTags)

    sqlite.exec('COMMIT')
    console.log(`[backup] Import complete (mode: ${mode})`)
  } catch (err) {
    sqlite.exec('ROLLBACK')
    throw err
  }
}
