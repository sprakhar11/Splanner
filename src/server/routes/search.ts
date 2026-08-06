import { Hono } from 'hono'
import { sqlite } from '../db/connection'
import { reindex, countRows } from '../db/search-index'

const searchRoute = new Hono()

/** Maps an entity type to the table and columns needed to render a result row. */
const DETAIL_QUERIES: Record<string, string> = {
  TASK: `SELECT id, title, date AS meta, status AS state, priority AS extra FROM tasks WHERE id = ?`,
  NOTE: `SELECT id, title, type AS meta, NULL AS state, NULL AS extra FROM notes WHERE id = ?`,
  REVISION: `SELECT id, title, next_due_date AS meta, NULL AS state, current_step_index AS extra FROM revision_items WHERE id = ?`,
  DSA: `SELECT id, title, category_pattern AS meta, status AS state, difficulty AS extra FROM dsa_problems WHERE id = ?`,
  SYSTEM_DESIGN: `SELECT id, title, category AS meta, NULL AS state, is_revised AS extra FROM system_design WHERE id = ?`,
  LLD: `SELECT id, title, pattern AS meta, status AS state, NULL AS extra FROM lld_designs WHERE id = ?`,
  HR: `SELECT id, title, question_category AS meta, NULL AS state, NULL AS extra FROM hr_stories WHERE id = ?`,
}

/**
 * Escapes user input for an FTS5 MATCH expression.
 *
 * FTS5 treats characters like " * ( ) : - ^ as syntax, so raw input such as
 * `two-pointer` or a stray quote raises a parse error and 500s the request.
 * Each token is wrapped in double quotes (with internal quotes doubled) to make
 * it a literal, and a trailing * on the last token keeps prefix search working
 * as the user types.
 */
export function buildMatchQuery(raw: string): string | null {
  const tokens = raw
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean)

  if (tokens.length === 0) return null

  return tokens
    .map((t, i) => {
      const quoted = `"${t.replace(/"/g, '""')}"`
      return i === tokens.length - 1 ? `${quoted}*` : quoted
    })
    .join(' AND ')
}

searchRoute.get('/', async (c) => {
  const q = c.req.query('q') ?? ''
  const limit = Math.min(Number(c.req.query('limit')) || 20, 50)
  const match = buildMatchQuery(q)
  if (!match) return c.json([])

  let hits: any[]
  try {
    hits = sqlite.prepare(
      `SELECT entity_type, entity_id,
              snippet(search_index, 2, '[', ']', '…', 12) AS snippet,
              bm25(search_index) AS score
       FROM search_index
       WHERE search_index MATCH ?
       ORDER BY score
       LIMIT ?`
    ).all(match, limit)
  } catch (err: any) {
    // A malformed expression should not take the palette down.
    return c.json({ error: `Search failed: ${err.message}` }, 400)
  }

  // Join each hit back to its source row so the client can render a real result.
  const results = []
  for (const hit of hits) {
    const sql = DETAIL_QUERIES[hit.entity_type as string]
    if (!sql) continue
    const row = sqlite.prepare(sql).get(hit.entity_id) as any
    // Skip index entries whose source row is gone.
    if (!row) continue
    results.push({
      entityType: hit.entity_type,
      entityId: hit.entity_id,
      title: row.title,
      meta: row.meta ?? null,
      state: row.state ?? null,
      extra: row.extra ?? null,
      snippet: hit.snippet ?? null,
      score: hit.score,
    })
  }

  return c.json(results)
})

/** Index health, useful for diagnosing a stale palette. */
searchRoute.get('/status', async (c) => {
  const byType = sqlite.prepare(
    `SELECT entity_type AS type, COUNT(*) AS count
     FROM search_index GROUP BY entity_type ORDER BY entity_type`
  ).all()
  return c.json({ total: countRows(), byType })
})

searchRoute.post('/reindex', async (c) => {
  const total = reindex()
  return c.json({ success: true, total })
})

export default searchRoute
