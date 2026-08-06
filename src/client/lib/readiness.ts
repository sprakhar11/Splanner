/**
 * Interview Readiness Score.
 *
 * Six weighted components, each scored 0..1. The score renormalises over the
 * components that actually have data:
 *
 *   score = 100 x SUM(weight_i x value_i) / SUM(weight_i)   over eligible i
 *
 * Renormalising rather than treating missing data as zero matters: on day one a
 * user who has only logged DSA would otherwise be capped in the 20s and see the
 * number barely move, which reads as broken. This way the score answers "how
 * ready are you in the areas you are tracking" and widens as coverage grows.
 */

export type ReadinessInput = {
  dsa: { status: string; difficulty: string }[]
  systemDesign: { isRevised: unknown }[]
  lld: { status: string }[]
  hrStories: { situation?: string | null; task?: string | null; action?: string | null; result?: string | null }[]
  revisions: { nextDueDate: string; totalRevisions: number }[]
  /** yyyy-MM-dd strings for every day with study or task activity. */
  activeDays: string[]
  /** Today as yyyy-MM-dd, injected so the result is deterministic in tests. */
  today: string
}

export type Component = {
  key: string
  label: string
  weight: number
  /** 0..1, or null when there is nothing to judge yet. */
  value: number | null
  /** Human-readable basis for the value, shown under the bar. */
  detail: string
}

export type Readiness = {
  /** 0..100, or null when no component has data. */
  score: number | null
  components: Component[]
  /** Sum of weights that counted toward the score. */
  eligibleWeight: number
  /** Lowest-scoring eligible component — the thing to work on next. */
  weakest: Component | null
}

/** Solved problems needed for full marks on coverage. */
export const DSA_TARGET = 150
/** Hard problems needed for full marks on difficulty balance. */
export const DSA_HARD_TARGET = 30
/** Complete STAR stories needed for full marks. */
export const HR_TARGET = 8
/** Window used for the consistency component. */
export const CONSISTENCY_WINDOW = 14

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

const STAR_KEYS = ['situation', 'task', 'action', 'result'] as const

export function isStoryComplete(s: ReadinessInput['hrStories'][number]) {
  return STAR_KEYS.every(k => (s[k] ?? '').trim().length > 0)
}

/** Counts days in the trailing window that appear in activeDays. */
export function activeDaysInWindow(activeDays: string[], today: string, window: number) {
  const set = new Set(activeDays)
  const end = new Date(today + 'T00:00:00')
  let count = 0
  for (let i = 0; i < window; i++) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (set.has(iso)) count++
  }
  return count
}

export function computeReadiness(input: ReadinessInput): Readiness {
  const { dsa, systemDesign, lld, hrStories, revisions, activeDays, today } = input

  // --- DSA coverage: how many problems solved, against a target
  const solved = dsa.filter(d => d.status === 'SOLVED')
  const dsaCoverage: Component = {
    key: 'dsaCoverage',
    label: 'DSA coverage',
    weight: 25,
    value: dsa.length === 0 ? null : clamp01(solved.length / DSA_TARGET),
    detail: dsa.length === 0
      ? 'No problems logged'
      : `${solved.length} solved of ${DSA_TARGET} target`,
  }

  // --- DSA difficulty balance: solving only easies is not readiness
  const hardSolved = solved.filter(d => d.difficulty === 'HARD').length
  const dsaDifficulty: Component = {
    key: 'dsaDifficulty',
    label: 'Hard problems',
    weight: 10,
    value: solved.length === 0 ? null : clamp01(hardSolved / DSA_HARD_TARGET),
    detail: solved.length === 0
      ? 'Nothing solved yet'
      : `${hardSolved} hard of ${DSA_HARD_TARGET} target`,
  }

  // --- System design: share of logged topics actually revised
  const sdRevised = systemDesign.filter(t => !!t.isRevised).length
  const sd: Component = {
    key: 'systemDesign',
    label: 'System design',
    weight: 20,
    value: systemDesign.length === 0 ? null : sdRevised / systemDesign.length,
    detail: systemDesign.length === 0
      ? 'No topics logged'
      : `${sdRevised} of ${systemDesign.length} topics revised`,
  }

  // --- LLD: share of logged designs implemented
  const lldDone = lld.filter(d => d.status === 'IMPLEMENTED').length
  const lldComp: Component = {
    key: 'lld',
    label: 'LLD',
    weight: 15,
    value: lld.length === 0 ? null : lldDone / lld.length,
    detail: lld.length === 0
      ? 'No designs logged'
      : `${lldDone} of ${lld.length} implemented`,
  }

  // --- HR: complete STAR stories against a target
  const complete = hrStories.filter(isStoryComplete).length
  const hr: Component = {
    key: 'hr',
    label: 'HR stories',
    weight: 15,
    value: hrStories.length === 0 ? null : clamp01(complete / HR_TARGET),
    detail: hrStories.length === 0
      ? 'No stories written'
      : `${complete} interview-ready of ${HR_TARGET} target`,
  }

  // --- Revision discipline: are you keeping up with what is due?
  const overdue = revisions.filter(r => r.nextDueDate < today).length
  const revision: Component = {
    key: 'revision',
    label: 'Revision discipline',
    weight: 10,
    value: revisions.length === 0 ? null : clamp01(1 - overdue / revisions.length),
    detail: revisions.length === 0
      ? 'No revision cards'
      : overdue === 0
        ? revisions.length === 1
          ? '1 card on schedule'
          : `All ${revisions.length} cards on schedule`
        : `${overdue} of ${revisions.length} cards overdue`,
  }

  // --- Consistency: showing up, measured over a trailing window
  const active = activeDaysInWindow(activeDays, today, CONSISTENCY_WINDOW)
  const consistency: Component = {
    key: 'consistency',
    label: 'Consistency',
    weight: 15,
    // Only judge consistency once there is any activity on record at all.
    value: activeDays.length === 0 ? null : clamp01(active / CONSISTENCY_WINDOW),
    detail: activeDays.length === 0
      ? 'No activity recorded'
      : `${active} active days in the last ${CONSISTENCY_WINDOW}`,
  }

  const components = [dsaCoverage, dsaDifficulty, sd, lldComp, hr, revision, consistency]
  const eligible = components.filter(c => c.value !== null)
  const eligibleWeight = eligible.reduce((sum, c) => sum + c.weight, 0)

  const score = eligibleWeight === 0
    ? null
    : Math.round(
        (100 * eligible.reduce((sum, c) => sum + c.weight * (c.value as number), 0)) / eligibleWeight
      )

  const weakest = eligible.length === 0
    ? null
    : eligible.reduce((lo, c) => ((c.value as number) < (lo.value as number) ? c : lo), eligible[0])

  return { score, components, eligibleWeight, weakest }
}

/** Plain-language band for a score, used for the gauge caption and colour. */
export function readinessBand(score: number | null) {
  if (score === null) return { label: 'Not enough data', color: 'var(--muted-foreground)' }
  if (score >= 80) return { label: 'Interview ready', color: 'var(--ev-green)' }
  if (score >= 60) return { label: 'Nearly there', color: 'var(--ev-teal)' }
  if (score >= 40) return { label: 'Building up', color: 'var(--ev-yellow)' }
  if (score >= 20) return { label: 'Early days', color: 'var(--ev-orange)' }
  return { label: 'Just starting', color: 'var(--ev-red)' }
}
