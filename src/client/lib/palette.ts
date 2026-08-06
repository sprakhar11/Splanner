/**
 * Pure helpers for the command palette: how results are labelled, grouped,
 * and how keyboard navigation moves through a flat list of items.
 */

export type SearchHit = {
  entityType: string
  entityId: string
  title: string
  meta: string | null
  state: string | null
  extra: string | number | null
  snippet: string | null
  score: number
}

export type PaletteItem =
  | { kind: 'command'; id: string; label: string; hint?: string; run: () => void }
  | { kind: 'result'; id: string; hit: SearchHit }

/** Where each entity type lives, so a hit can navigate somewhere useful. */
export const ROUTE_FOR: Record<string, string> = {
  TASK: '/planner',
  NOTE: '/journal',
  REVISION: '/revise',
  DSA: '/interview',
  SYSTEM_DESIGN: '/interview',
  LLD: '/interview',
  HR: '/interview',
}

export const GROUP_LABEL: Record<string, string> = {
  TASK: 'Tasks',
  NOTE: 'Notes',
  REVISION: 'Revision cards',
  DSA: 'DSA problems',
  SYSTEM_DESIGN: 'System design',
  LLD: 'LLD designs',
  HR: 'HR stories',
}

export const TYPE_COLOR: Record<string, string> = {
  TASK: 'var(--ev-blue)',
  NOTE: 'var(--ev-teal)',
  REVISION: 'var(--ev-purple)',
  DSA: 'var(--ev-orange)',
  SYSTEM_DESIGN: 'var(--ev-pink)',
  LLD: 'var(--ev-green)',
  HR: 'var(--ev-yellow)',
}

/** Renders the FTS5 snippet markers as plain segments for safe highlighting. */
export function parseSnippet(snippet: string | null): { text: string; match: boolean }[] {
  if (!snippet) return []
  const parts: { text: string; match: boolean }[] = []
  const re = /\[([^\]]*)\]/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(snippet)) !== null) {
    if (m.index > last) parts.push({ text: snippet.slice(last, m.index), match: false })
    parts.push({ text: m[1], match: true })
    last = m.index + m[0].length
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), match: false })
  return parts
}

/** Case-insensitive substring filter used for the command list. */
export function filterCommands<T extends { label: string; hint?: string }>(
  commands: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter(c =>
    c.label.toLowerCase().includes(q) || (c.hint?.toLowerCase().includes(q) ?? false)
  )
}

/** Groups hits by entity type, preserving the relevance order within a group. */
export function groupHits(hits: SearchHit[]): { type: string; hits: SearchHit[] }[] {
  const order: string[] = []
  const map = new Map<string, SearchHit[]>()
  for (const h of hits) {
    if (!map.has(h.entityType)) { map.set(h.entityType, []); order.push(h.entityType) }
    map.get(h.entityType)!.push(h)
  }
  return order.map(type => ({ type, hits: map.get(type)! }))
}

/** Wraps the active index within bounds, so arrow keys cycle. */
export function moveIndex(current: number, delta: number, length: number): number {
  if (length === 0) return 0
  return (current + delta + length) % length
}
