/**
 * Typed view over the settings key-value table.
 *
 * The server stores every value as TEXT, so each setting declares how to parse
 * and serialise itself. Reads always fall back to the default, which means a
 * missing or corrupted row degrades to a sane value instead of undefined.
 *
 * Keys mirror DEFAULT_SETTINGS in src/server/db/seed.ts. Do not invent new keys
 * here without adding them there too, or a fresh database and an upgraded one
 * will disagree.
 */

export type SettingsMap = Record<string, string>

export const DEFAULTS = {
  userName: 'Prakhar',
  darkMode: 'system', // system | light | dark
  fontScale: 'default', // default | large | extra-large
  dailyStudyGoalHours: 4,
  notificationsEnabled: true,
  taskReminders: true,
  revisionReminders: true,
  reflectionReminder: true,
  weekStartsMonday: false,
  pomodoroMinutes: 25,
  focusPopOut: true,
  rolloverHour: 0,
  disabledTabs: '',
} as const

/**
 * Keys the server seeds but the client does not manage yet, because the
 * features they gate do not exist: waterBreakReminders, weeklyPlanningPrompt,
 * monthlyReviewPrompt. They are deliberately absent from DEFAULTS so no control
 * is rendered for them and saving never touches their stored values.
 */
export const UNMANAGED_KEYS = [
  'theme', 'waterBreakReminders', 'weeklyPlanningPrompt', 'monthlyReviewPrompt',
] as const

export type SettingKey = keyof typeof DEFAULTS

/** Settings offering a fixed set of choices. */
export const CHOICES: Partial<Record<SettingKey, readonly string[]>> = {
  darkMode: ['system', 'light', 'dark'],
  fontScale: ['default', 'large', 'extra-large'],
}

/** Reads a setting, coercing the stored string back to the default's type. */
export function readSetting<K extends SettingKey>(
  settings: SettingsMap | undefined,
  key: K
): (typeof DEFAULTS)[K] {
  const fallback = DEFAULTS[key]
  const raw = settings?.[key]
  if (raw === undefined || raw === '') return fallback

  if (typeof fallback === 'boolean') {
    return (raw === 'true') as (typeof DEFAULTS)[K]
  }
  if (typeof fallback === 'number') {
    const n = Number(raw)
    return (Number.isFinite(n) ? n : fallback) as (typeof DEFAULTS)[K]
  }
  // Reject a stored value that is no longer a valid choice.
  const choices = CHOICES[key]
  if (choices && !choices.includes(raw)) return fallback
  return raw as (typeof DEFAULTS)[K]
}

/** Serialises a value for storage. */
export function writeSetting(value: string | number | boolean): string {
  return String(value)
}

/** Reads every known setting at once, applying defaults. */
export function readAll(settings: SettingsMap | undefined) {
  const out = {} as { [K in SettingKey]: (typeof DEFAULTS)[K] }
  for (const key of Object.keys(DEFAULTS) as SettingKey[]) {
    out[key] = readSetting(settings, key)
  }
  return out
}

const RANGES: Partial<Record<SettingKey, [number, number]>> = {
  dailyStudyGoalHours: [0.5, 16],
  pomodoroMinutes: [5, 180],
  rolloverHour: [0, 6],
}

/** Clamps a numeric setting into a sensible range before saving. */
export function clampSetting(key: SettingKey, value: number): number {
  const range = RANGES[key]
  if (!range) return value
  const clamped = Math.max(range[0], Math.min(range[1], value))
  // Study goal is expressed in half hours; everything else is whole units.
  return key === 'dailyStudyGoalHours'
    ? Math.round(clamped * 2) / 2
    : Math.round(clamped)
}

/** Tabs that can be disabled from Settings. */
export const OPTIONAL_TABS = ['revise', 'stats', 'life', 'interview', 'reflection'] as const
export type OptionalTab = typeof OPTIONAL_TABS[number]

const TAB_LABELS: Record<OptionalTab, string> = {
  revise: 'Revise',
  stats: 'Stats',
  life: 'Life',
  interview: 'Interview Prep',
  reflection: 'Reflection',
}

export function getTabLabel(tab: OptionalTab): string {
  return TAB_LABELS[tab]
}

/** Parse the stored comma-separated list of disabled tab keys. */
export function getDisabledTabs(settings: SettingsMap | undefined): Set<OptionalTab> {
  const raw = settings?.disabledTabs || ''
  if (!raw) return new Set()
  const tabs = raw.split(',').map(s => s.trim()).filter(Boolean)
  return new Set(tabs.filter(t => (OPTIONAL_TABS as readonly string[]).includes(t)) as OptionalTab[])
}

/** Check if a specific tab is enabled. */
export function isTabEnabled(settings: SettingsMap | undefined, tab: OptionalTab): boolean {
  return !getDisabledTabs(settings).has(tab)
}
