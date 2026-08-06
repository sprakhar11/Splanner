import { sqlite } from './connection'

/**
 * FTS5 search index setup, kept idempotent and self-healing so a fresh clone and
 * an existing database converge on the same shape without a migration runner.
 *
 * History: the original table was declared `content=''` (contentless). In that
 * mode FTS5 stores only the inverted index, so selecting entity_type/entity_id
 * or calling snippet() yields NULL, and `DELETE ... WHERE entity_id = ?` matches
 * nothing because the columns are unreadable. Search returned rows of nulls and
 * the delete triggers silently leaked orphans. This module rebuilds the table as
 * a normal content-storing FTS5 table, where both retrieval and deletes work.
 */

/** One entry per searchable entity: the table, its label, and the text to index. */
const SOURCES = [
  {
    type: 'TASK',
    table: 'tasks',
    text: "title || ' ' || COALESCE(description, '')",
    newText: "NEW.title || ' ' || COALESCE(NEW.description, '')",
  },
  {
    type: 'NOTE',
    table: 'notes',
    text: "title || ' ' || COALESCE(content, '')",
    newText: "NEW.title || ' ' || COALESCE(NEW.content, '')",
  },
  {
    type: 'REVISION',
    table: 'revision_items',
    text: "title || ' ' || COALESCE(concept, '')",
    newText: "NEW.title || ' ' || COALESCE(NEW.concept, '')",
  },
  {
    type: 'DSA',
    table: 'dsa_problems',
    text: "title || ' ' || COALESCE(category_pattern, '') || ' ' || COALESCE(mistakes_notes, '')",
    newText: "NEW.title || ' ' || COALESCE(NEW.category_pattern, '') || ' ' || COALESCE(NEW.mistakes_notes, '')",
  },
  {
    type: 'SYSTEM_DESIGN',
    table: 'system_design',
    text: "title || ' ' || COALESCE(notes, '')",
    newText: "NEW.title || ' ' || COALESCE(NEW.notes, '')",
  },
  {
    type: 'LLD',
    table: 'lld_designs',
    text: "title || ' ' || COALESCE(description, '')",
    newText: "NEW.title || ' ' || COALESCE(NEW.description, '')",
  },
  {
    type: 'HR',
    table: 'hr_stories',
    text: "title || ' ' || COALESCE(situation, '') || ' ' || COALESCE(action, '') || ' ' || COALESCE(result, '')",
    newText: "NEW.title || ' ' || COALESCE(NEW.situation, '') || ' ' || COALESCE(NEW.action, '') || ' ' || COALESCE(NEW.result, '')",
  },
] as const

export const SEARCHABLE_TYPES = SOURCES.map(s => s.type)

const CREATE_TABLE = `
  CREATE VIRTUAL TABLE search_index USING fts5(
    entity_type,
    entity_id,
    searchable_text,
    tokenize='porter unicode61'
  )
`

/** True when the existing table was created contentless and cannot be read back. */
function isLegacyContentless(): boolean {
  const row = sqlite.prepare(
    `SELECT sql FROM sqlite_master WHERE name = 'search_index'`
  ).get() as { sql?: string } | undefined
  if (!row?.sql) return false
  return /content\s*=\s*''/.test(row.sql)
}

function tableExists(): boolean {
  return !!sqlite.prepare(
    `SELECT 1 FROM sqlite_master WHERE name = 'search_index'`
  ).get()
}

function dropTriggers() {
  for (const s of SOURCES) {
    for (const suffix of ['ai', 'au', 'ad']) {
      sqlite.exec(`DROP TRIGGER IF EXISTS ${s.table}_${suffix}`)
    }
  }
}

function createTriggers() {
  for (const s of SOURCES) {
    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS ${s.table}_ai AFTER INSERT ON ${s.table} BEGIN
        INSERT INTO search_index(entity_type, entity_id, searchable_text)
        VALUES ('${s.type}', NEW.id, ${s.newText});
      END
    `)
    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS ${s.table}_au AFTER UPDATE ON ${s.table} BEGIN
        DELETE FROM search_index WHERE entity_type = '${s.type}' AND entity_id = OLD.id;
        INSERT INTO search_index(entity_type, entity_id, searchable_text)
        VALUES ('${s.type}', NEW.id, ${s.newText});
      END
    `)
    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS ${s.table}_ad AFTER DELETE ON ${s.table} BEGIN
        DELETE FROM search_index WHERE entity_type = '${s.type}' AND entity_id = OLD.id;
      END
    `)
  }
}

/** Repopulates the index from every source table. */
function backfill() {
  sqlite.exec('DELETE FROM search_index')
  for (const s of SOURCES) {
    sqlite.exec(`
      INSERT INTO search_index(entity_type, entity_id, searchable_text)
      SELECT '${s.type}', id, ${s.text} FROM ${s.table}
    `)
  }
}

/** Rebuilds the table from scratch, then reinstalls triggers and data. */
function rebuild() {
  dropTriggers()
  sqlite.exec('DROP TABLE IF EXISTS search_index')
  sqlite.exec(CREATE_TABLE)
  createTriggers()
  backfill()
}

/**
 * Ensures the index exists, is readable, and is consistent with the source
 * tables. Safe to call on every boot.
 */
export function ensureSearchIndex() {
  if (!tableExists()) {
    console.log('[search] Creating FTS5 index...')
    sqlite.exec(CREATE_TABLE)
    createTriggers()
    backfill()
    console.log(`[search] Indexed ${countRows()} rows.`)
    return
  }

  if (isLegacyContentless()) {
    console.log('[search] Rebuilding contentless FTS5 index (results were unreadable)...')
    rebuild()
    console.log(`[search] Rebuilt with ${countRows()} rows.`)
    return
  }

  // Triggers may be missing even when the table is fine.
  createTriggers()

  // Orphans accumulate if the app ever ran with broken delete triggers.
  const expected = SOURCES.reduce(
    (sum, s) => sum + (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${s.table}`).get() as any).n,
    0
  )
  if (countRows() !== expected) {
    console.log(`[search] Index drift detected (${countRows()} indexed vs ${expected} rows). Reindexing...`)
    backfill()
  }
}

export function countRows(): number {
  return (sqlite.prepare('SELECT COUNT(*) AS n FROM search_index').get() as any).n
}

/** Forces a full reindex. Exposed for the API and verification scripts. */
export function reindex() {
  if (!tableExists() || isLegacyContentless()) {
    rebuild()
  } else {
    createTriggers()
    backfill()
  }
  return countRows()
}
