/**
 * Migrates existing dsa_problems, system_design, lld_designs rows into the
 * unified interview_items table. Runs at boot, idempotent.
 */
import { sqlite } from './connection'

export function migrateInterviewItems() {
  // Create the table if it does not exist yet.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS interview_items (
      id TEXT PRIMARY KEY,
      topic_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      link TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'DONE',
      revision_item_id TEXT,
      linked_task_id TEXT,
      schedule_revision INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  // Add columns if they don't exist (for existing databases).
  try { sqlite.exec(`ALTER TABLE interview_items ADD COLUMN linked_task_id TEXT`) } catch {}
  try { sqlite.exec(`ALTER TABLE interview_items ADD COLUMN schedule_revision INTEGER NOT NULL DEFAULT 0`) } catch {}

  // Only migrate if the table is empty (first run).
  const count = (sqlite.prepare('SELECT COUNT(*) AS n FROM interview_items').get() as any).n
  if (count > 0) return { migrated: 0, message: 'Already migrated' }

  let migrated = 0

  // Migrate DSA
  const dsaRows = sqlite.prepare('SELECT * FROM dsa_problems').all() as any[]
  for (const row of dsaRows) {
    const tags = [row.category_pattern, row.difficulty, row.platform].filter(Boolean)
    const desc = [row.mistakes_notes, row.solution_snippet].filter(Boolean).join('\n\n')
    sqlite.prepare(`
      INSERT INTO interview_items (id, topic_type, title, description, link, tags, status, created_at)
      VALUES (?, 'DSA', ?, ?, ?, ?, 'DONE', ?)
    `).run(row.id, row.title, desc, row.url || '', JSON.stringify(tags), Date.now())
    migrated++
  }

  // Migrate System Design
  const sdRows = sqlite.prepare('SELECT * FROM system_design').all() as any[]
  for (const row of sdRows) {
    const tags = [row.category].filter(Boolean)
    let tradeoffs = ''
    try { tradeoffs = JSON.parse(row.key_tradeoffs || '[]').join(', ') } catch {}
    const desc = [row.notes, tradeoffs ? `Tradeoffs: ${tradeoffs}` : ''].filter(Boolean).join('\n\n')
    sqlite.prepare(`
      INSERT INTO interview_items (id, topic_type, title, description, link, tags, status, created_at)
      VALUES (?, 'SYSTEM_DESIGN', ?, ?, '', ?, 'DONE', ?)
    `).run(row.id, row.title, desc, JSON.stringify(tags), Date.now())
    migrated++
  }

  // Migrate LLD
  const lldRows = sqlite.prepare('SELECT * FROM lld_designs').all() as any[]
  for (const row of lldRows) {
    const tags = [row.pattern].filter(Boolean)
    const desc = [row.description, row.code_snippet].filter(Boolean).join('\n\n')
    sqlite.prepare(`
      INSERT INTO interview_items (id, topic_type, title, description, link, tags, status, created_at)
      VALUES (?, 'LLD', ?, ?, '', ?, 'DONE', ?)
    `).run(row.id, row.title, desc, JSON.stringify(tags), Date.now())
    migrated++
  }

  if (migrated > 0) {
    console.log(`[migration] Migrated ${migrated} interview items into unified table.`)
  }

  return { migrated, message: `Migrated ${migrated} items` }
}
