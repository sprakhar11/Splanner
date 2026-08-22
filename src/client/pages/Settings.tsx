import { useEffect, useRef, useState } from 'react'
import {
  Bell, Download, Upload, RotateCcw, Plus, Trash2, Check, AlertTriangle,
  User, Target, Database, Palette, Briefcase, BookOpen, Heart, LayoutGrid,
} from 'lucide-react'
import { useSettings, useUpdateSettings } from '@client/hooks/useSettings'
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
} from '@client/hooks/useCategories'
import { requestNotificationPermission } from '@client/hooks/useReminders'
import { useToast } from '@client/components/ui/toast'
import {
  readAll, writeSetting, clampSetting, DEFAULTS, CHOICES, type SettingKey,
  OPTIONAL_TABS, getTabLabel, getDisabledTabs, type OptionalTab,
} from '@client/lib/settings'
import { api } from '@client/api/client'
import { cn } from '@client/lib/utils'

/** ARGB integers, matching the categories.color column. */
const SWATCHES = [
  0xff3b82f6, 0xff8b5cf6, 0xff06b6d4, 0xff10b981,
  0xfff59e0b, 0xffef4444, 0xffec4899, 0xff64748b,
]

const argbToCss = (argb: number) => `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`

export default function Settings() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { toast } = useToast()

  const [draft, setDraft] = useState(() => readAll(undefined))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(readAll(settings))
    setDirty(false)
  }, [settings])

  const set = <K extends SettingKey>(key: K, value: (typeof DEFAULTS)[K]) => {
    setDraft(d => ({ ...d, [key]: value }))
    setDirty(true)
  }

  const setNumber = (key: SettingKey, raw: number) => {
    set(key, clampSetting(key, Number.isFinite(raw) ? raw : 0) as any)
  }

  const save = () => {
    const payload: Record<string, string> = {}
    for (const key of Object.keys(DEFAULTS) as SettingKey[]) {
      payload[key] = writeSetting(draft[key])
    }
    updateSettings.mutate(payload, {
      onSuccess: () => {
        setDirty(false)
        toast({ title: 'Settings saved', tone: 'success' })
      },
      onError: (e: any) =>
        toast({ title: 'Could not save settings', body: e.message, tone: 'warning' }),
    })
  }

  /** Notifications need a real user gesture to request permission. */
  const toggleNotifications = async (enabled: boolean) => {
    if (!enabled) { set('notificationsEnabled', false); return }

    const result = await requestNotificationPermission()
    if (result === 'granted') {
      set('notificationsEnabled', true)
      toast({ title: 'Notifications enabled', body: 'Reminders will surface outside the app too.', tone: 'success' })
    } else if (result === 'unsupported') {
      set('notificationsEnabled', false)
      toast({ title: 'Not supported', body: 'This browser has no Notification API.', tone: 'warning' })
    } else {
      set('notificationsEnabled', false)
      toast({
        title: 'Permission denied',
        body: 'In-app reminders still work. Re-enable notifications in your browser site settings.',
        tone: 'warning',
      })
    }
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Settings</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Everything is stored locally in your own SQLite file.
          </p>
        </div>

        <button
          onClick={save}
          disabled={!dirty || updateSettings.isPending}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: 'var(--grad-selected)' }}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
          {updateSettings.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>

      <div className="grid gap-3 pb-2 lg:grid-cols-2">
        {/* Profile */}
        <Section icon={User} title="Profile" hint="Used for the greeting in the top bar">
          <Row label="Your name">
            <input
              value={draft.userName}
              onChange={e => set('userName', e.target.value)}
              className="h-8 w-40 rounded-md border border-input bg-background px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
          </Row>
          <Row label="Week starts on Monday" hint="Reorders the planner's month grid">
            <Toggle
              checked={draft.weekStartsMonday}
              onChange={v => set('weekStartsMonday', v)}
              label="Week starts on Monday"
            />
          </Row>
        </Section>

        {/* Goals */}
        <Section icon={Target} title="Goals" hint="The stats page measures you against these">
          <Row label="Daily study goal">
            <NumInput
              value={draft.dailyStudyGoalHours}
              onChange={v => setNumber('dailyStudyGoalHours', v)}
              suffix="hours"
              step={0.5}
            />
          </Row>
          <Row label="Default focus length" hint="Estimate used for a new task">
            <NumInput
              value={draft.pomodoroMinutes}
              onChange={v => setNumber('pomodoroMinutes', v)}
              suffix="min"
              step={5}
            />
          </Row>
          <Row
            label="Float the clock on start"
            hint="Opens an always-on-top window so the timer stays visible in other tabs"
          >
            <Toggle
              checked={draft.focusPopOut}
              onChange={v => set('focusPopOut', v)}
              label="Float the clock on start"
            />
          </Row>
        </Section>

        {/* Notifications */}
        <Section
          icon={Bell}
          title="Notifications"
          hint="In-app toasts always work. OS notifications need browser permission."
        >
          <Row label="OS notifications" hint="Shown even when Splanner is in a background tab">
            <Toggle
              checked={draft.notificationsEnabled}
              onChange={toggleNotifications}
              label="OS notifications"
            />
          </Row>
          <Row label="Task reminders" hint="Alerts at a task's reminder time">
            <Toggle
              checked={draft.taskReminders}
              onChange={v => set('taskReminders', v)}
              label="Task reminders"
            />
          </Row>
          <Row label="Overdue and revision alerts" hint="Warns when a deadline or card is overdue">
            <Toggle
              checked={draft.revisionReminders}
              onChange={v => set('revisionReminders', v)}
              label="Overdue and revision alerts"
            />
          </Row>
          <Row label="Evening reflection nudge" hint="After 8pm, if the day is still unwritten">
            <Toggle
              checked={draft.reflectionReminder}
              onChange={v => set('reflectionReminder', v)}
              label="Evening reflection nudge"
            />
          </Row>
          <Row label="Habit nudge" hint="After 7pm, if any habit is still open today">
            <Toggle
              checked={draft.habitReminders}
              onChange={v => set('habitReminders', v)}
              label="Habit nudge"
            />
          </Row>
          <Row label="Day ends at" hint="Incomplete tasks move to tomorrow after this hour. Set later if you study at night.">
            <NumInput
              value={draft.rolloverHour}
              onChange={v => setNumber('rolloverHour', v)}
              suffix={draft.rolloverHour === 0 ? 'midnight' : `${String(draft.rolloverHour).padStart(2, '0')}:00`}
              step={1}
              min={0}
              max={6}
            />
          </Row>
        </Section>

        {/* Appearance */}
        <Section icon={Palette} title="Appearance" hint="Applies immediately once saved">
          <Row label="Theme">
            <ChoiceGroup
              value={draft.darkMode}
              options={CHOICES.darkMode!}
              onChange={v => set('darkMode', v as any)}
              label="Theme"
            />
          </Row>
          <Row label="Text size">
            <ChoiceGroup
              value={draft.fontScale}
              options={CHOICES.fontScale!}
              onChange={v => set('fontScale', v as any)}
              label="Text size"
            />
          </Row>
        </Section>

        <CategoriesSection />

        {/* Visible Tabs */}
        <Section icon={LayoutGrid} title="Visible tabs" hint="Hide tabs you don't use. Data is kept — re-enable anytime.">
          {OPTIONAL_TABS.map(tab => {
            const disabledSet = getDisabledTabs(settings)
            const enabled = !disabledSet.has(tab)
            const toggleTab = (on: boolean) => {
              const current = getDisabledTabs(settings)
              if (on) current.delete(tab); else current.add(tab)
              const value = [...current].join(',')
              updateSettings.mutate({ disabledTabs: value })
            }
            return (
              <Row key={tab} label={getTabLabel(tab)}>
                <Toggle checked={enabled} onChange={toggleTab} label={getTabLabel(tab)} />
              </Row>
            )
          })}
        </Section>
        <NoteTypesSection />
        <LifeSection />
        <InterviewTargetsSection />
        <DataSection />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ sections */

function CategoriesSection() {
  const { data: categories = [] } = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[0])

  const add = () => {
    if (!name.trim()) return
    create.mutate(
      { name: name.trim(), color, iconName: 'folder', position: categories.length },
      {
        onSuccess: () => { setName(''); toast({ title: `Added "${name.trim()}"`, tone: 'success' }) },
        onError: (e: any) => toast({ title: 'Could not add category', body: e.message, tone: 'warning' }),
      }
    )
  }

  const restore = () => {
    if (!confirm('Replace all categories with the defaults? Tasks keep their data but lose their category.')) return
    api.categories.restoreDefaults()
      .then(() => {
        toast({ title: 'Default categories restored', tone: 'success' })
        location.reload()
      })
      .catch((e: any) => toast({ title: 'Restore failed', body: e.message, tone: 'warning' }))
  }

  return (
    <Section icon={Database} title="Categories" hint={`${categories.length} in use`}>
      <div className="space-y-1.5">
        {(categories as any[]).map(c => (
          <div key={c.id} className="flex items-center gap-2.5 rounded-lg bg-surface-3 px-3 py-2 ring-1 ring-border">
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20"
              style={{ background: argbToCss(c.color) }}
            />
            <input
              defaultValue={c.name}
              onBlur={e => {
                const next = e.target.value.trim()
                if (next && next !== c.name) update.mutate({ id: c.id, data: { name: next } })
              }}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] focus:outline-none"
              aria-label={`Rename ${c.name}`}
            />
            <div className="flex shrink-0 gap-1">
              {SWATCHES.map(s => (
                <button
                  key={s}
                  onClick={() => update.mutate({ id: c.id, data: { color: s } })}
                  aria-label={`Set ${c.name} colour`}
                  className={cn(
                    'h-3 w-3 rounded-full ring-1 transition hover:scale-125',
                    c.color === s ? 'ring-foreground' : 'ring-transparent'
                  )}
                  style={{ background: argbToCss(s) }}
                />
              ))}
            </div>
            <button
              onClick={() => {
                if (confirm(`Delete "${c.name}"? Tasks in it are kept but become uncategorised.`)) {
                  remove.mutate(c.id)
                }
              }}
              aria-label={`Delete ${c.name}`}
              className="shrink-0 text-muted-foreground transition hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex gap-1">
          {SWATCHES.slice(0, 4).map(s => (
            <button
              key={s}
              onClick={() => setColor(s)}
              aria-label="Pick colour for the new category"
              className={cn(
                'h-4 w-4 rounded-full ring-1 transition',
                color === s ? 'ring-foreground' : 'ring-transparent'
              )}
              style={{ background: argbToCss(s) }}
            />
          ))}
        </div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="New category"
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md bg-surface-3 px-2.5 text-[12px] ring-1 ring-border transition hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      <button
        onClick={restore}
        className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground transition hover:text-foreground"
      >
        <RotateCcw className="h-3 w-3" /> Restore defaults
      </button>
    </Section>
  )
}

function LifeSection() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { toast } = useToast()

  const dob = settings?.dob || ''
  const expectedYears = settings?.lifeExpectedYears || '80'
  const goals: { name: string; deadline: string; addedOn: string }[] = (() => {
    try { return settings?.lifeGoals ? JSON.parse(settings.lifeGoals) : [] } catch { return [] }
  })()

  const [newGoal, setNewGoal] = useState('')
  const [newDeadline, setNewDeadline] = useState('')

  const saveDob = (value: string) => {
    updateSettings.mutate({ dob: value }, {
      onSuccess: () => toast({ title: 'DOB saved', tone: 'success' }),
    })
  }

  const saveExpectedYears = (value: string) => {
    const n = Math.max(1, Math.min(120, Number(value) || 80))
    updateSettings.mutate({ lifeExpectedYears: String(n) })
  }

  const addGoal = () => {
    if (!newGoal.trim() || !newDeadline) return
    const today = new Date().toISOString().slice(0, 10)
    const updated = [...goals, { name: newGoal.trim(), deadline: newDeadline, addedOn: today }]
    updateSettings.mutate({ lifeGoals: JSON.stringify(updated) }, {
      onSuccess: () => {
        setNewGoal('')
        setNewDeadline('')
        toast({ title: `Added "${newGoal.trim()}"`, tone: 'success' })
      },
    })
  }

  const removeGoal = (idx: number) => {
    const updated = goals.filter((_, i) => i !== idx)
    updateSettings.mutate({ lifeGoals: JSON.stringify(updated) }, {
      onSuccess: () => toast({ title: 'Goal removed', tone: 'success' }),
    })
  }

  return (
    <Section icon={Heart} title="Life" hint="DOB, expected lifespan, and goals with deadlines">
      <Row label="Date of birth">
        <input
          type="date"
          value={dob}
          onChange={e => saveDob(e.target.value)}
          className="h-8 w-40 rounded-md border border-input bg-background px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/60"
        />
      </Row>
      <Row label="Expected lifespan" hint="Used for the life calendar">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={120}
            value={expectedYears}
            onChange={e => saveExpectedYears(e.target.value)}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-[12.5px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
          <span className="text-[11px] text-muted-foreground">years</span>
        </div>
      </Row>

      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2.5 text-[11px] font-medium text-muted-foreground">Goals</p>
        {goals.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {goals.map((g, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg bg-surface-3 px-3 py-2 ring-1 ring-border">
                <span className="min-w-0 flex-1 text-[12.5px] font-medium">{g.name}</span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                  due {g.deadline}
                </span>
                <button
                  onClick={() => removeGoal(i)}
                  aria-label={`Remove ${g.name}`}
                  className="shrink-0 text-muted-foreground transition hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={newGoal}
            onChange={e => setNewGoal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addGoal() }}
            placeholder="Goal name"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
          <input
            type="date"
            value={newDeadline}
            onChange={e => setNewDeadline(e.target.value)}
            className="h-8 w-36 rounded-md border border-input bg-background px-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
          <button
            onClick={addGoal}
            disabled={!newGoal.trim() || !newDeadline}
            className="flex h-8 shrink-0 items-center gap-1 rounded-md bg-surface-3 px-2.5 text-[12px] ring-1 ring-border transition hover:text-foreground disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>
    </Section>
  )
}

const DEFAULT_NOTE_TYPES = ['CONCEPT', 'INTERVIEW_QUESTION', 'CODE_SNIPPET', 'MISTAKE', 'GENERAL']

function NoteTypesSection() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { toast } = useToast()
  const [newType, setNewType] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})

  // Load counts on mount
  useEffect(() => {
    fetch('/api/notes/count-by-type')
      .then(r => r.json())
      .then(setCounts)
      .catch(() => {})
  }, [])

  // Parse stored types — if set, use that; otherwise use defaults
  const noteTypes: string[] = (() => {
    try { return settings?.noteTypes ? JSON.parse(settings.noteTypes) : [] } catch { return [] }
  })()
  const allTypes = noteTypes.length > 0 ? noteTypes : DEFAULT_NOTE_TYPES

  const addType = () => {
    const name = newType.trim().toUpperCase().replace(/\s+/g, '_')
    if (!name || allTypes.includes(name)) return
    const updated = [...allTypes, name]
    updateSettings.mutate({ noteTypes: JSON.stringify(updated) }, {
      onSuccess: () => {
        setNewType('')
        toast({ title: `Added "${typeDisplay(name)}"`, tone: 'success' })
      },
    })
  }

  const deleteType = (type: string) => {
    if (allTypes.length <= 1) {
      toast({ title: 'Cannot delete the last type', tone: 'warning' })
      return
    }
    const count = counts[type] || 0
    if (count > 0) {
      if (!confirm(
        `"${typeDisplay(type)}" has ${count} note${count > 1 ? 's' : ''} using it.\n\nDeleting this type will leave those notes with an unrecognized type. They'll still exist but won't appear in the type filter until you recategorize them.\n\nContinue?`
      )) return
    } else {
      if (!confirm(`Delete "${typeDisplay(type)}"?`)) return
    }
    const updated = allTypes.filter(t => t !== type)
    updateSettings.mutate({ noteTypes: JSON.stringify(updated) }, {
      onSuccess: () => toast({ title: `Removed "${typeDisplay(type)}"`, tone: 'success' }),
    })
  }

  return (
    <Section icon={BookOpen} title="Note types" hint={`${allTypes.length} types configured`}>
      <div className="space-y-1.5">
        {allTypes.map(type => {
          const count = counts[type] || 0
          return (
            <div key={type} className="flex items-center gap-2.5 rounded-lg bg-surface-3 px-3 py-2 ring-1 ring-border">
              <span className="min-w-0 flex-1 text-[12.5px] font-medium">{typeDisplay(type)}</span>
              {count > 0 && (
                <span className="text-[10.5px] tabular-nums text-muted-foreground">{count} note{count > 1 ? 's' : ''}</span>
              )}
              <button
                onClick={() => deleteType(type)}
                aria-label={`Delete ${typeDisplay(type)}`}
                className="shrink-0 text-muted-foreground transition hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={newType}
          onChange={e => setNewType(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addType() }}
          placeholder="New type (e.g. Resource)"
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
        />
        <button
          onClick={addType}
          disabled={!newType.trim()}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md bg-surface-3 px-2.5 text-[12px] ring-1 ring-border transition hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    </Section>
  )
}

function typeDisplay(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function InterviewTargetsSection() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { toast } = useToast()

  const DEFAULT_TOPICS = ['DSA', 'SYSTEM_DESIGN', 'LLD']

  // Parse stored topics and targets.
  // If interviewTopics is set, it IS the authoritative list (user may have deleted defaults).
  // If not set, fall back to the 3 defaults.
  const topics: string[] = (() => {
    try { return settings?.interviewTopics ? JSON.parse(settings.interviewTopics) : [] } catch { return [] }
  })()
  const allTopics = topics.length > 0 ? topics : DEFAULT_TOPICS

  const targets: Record<string, { daily: number; monthly: number }> = (() => {
    try { return settings?.interviewTargets ? JSON.parse(settings.interviewTargets) : {} } catch { return {} }
  })()

  const [newTopic, setNewTopic] = useState('')

  const saveTargets = (updated: Record<string, { daily: number; monthly: number }>) => {
    updateSettings.mutate({ interviewTargets: JSON.stringify(updated) }, {
      onSuccess: () => toast({ title: 'Targets saved', tone: 'success' }),
    })
  }

  const addTopic = () => {
    const name = newTopic.trim().toUpperCase().replace(/\s+/g, '_')
    if (!name || allTopics.includes(name)) return
    const updated = [...allTopics, name]
    updateSettings.mutate({ interviewTopics: JSON.stringify(updated) }, {
      onSuccess: () => {
        setNewTopic('')
        toast({ title: `Added "${topicDisplay(name)}"`, tone: 'success' })
      },
    })
  }

  const renameTopic = (oldName: string, newName: string) => {
    const normalized = newName.trim().toUpperCase().replace(/\s+/g, '_')
    if (!normalized || normalized === oldName || allTopics.includes(normalized)) return

    // Update the topics list
    const updatedTopics = topics.map(t => t === oldName ? normalized : t)
    // If it was a default, add it as a custom rename mapping
    const isDefault = DEFAULT_TOPICS.includes(oldName)
    const finalTopics = isDefault
      ? [...updatedTopics.filter(t => !DEFAULT_TOPICS.includes(t)), normalized]
      : updatedTopics

    // Move the targets entry to the new key
    const updatedTargets = { ...targets }
    if (updatedTargets[oldName]) {
      updatedTargets[normalized] = updatedTargets[oldName]
      delete updatedTargets[oldName]
    }

    updateSettings.mutate({
      interviewTopics: JSON.stringify(finalTopics),
      interviewTargets: JSON.stringify(updatedTargets),
    }, {
      onSuccess: () => {
        // Rename the topicType on all matching items
        api.interviewItems.list(oldName).then(items => {
          for (const item of items) {
            api.interviewItems.update(item.id, { topicType: normalized })
          }
        })
        toast({ title: `Renamed to "${topicDisplay(normalized)}"`, tone: 'success' })
      },
    })
  }

  const deleteTopic = (topic: string) => {
    if (allTopics.length <= 1) {
      toast({ title: 'Cannot delete the last topic', tone: 'warning' })
      return
    }
    if (!confirm(
      `Delete "${topicDisplay(topic)}"?\n\nItems in this topic will remain in the database but won't appear under any tab until you recategorize them.`
    )) return

    // Remove from the full active list and persist as the custom list.
    // Once a default is deleted, the remaining defaults must be explicitly stored
    // so they don't reappear from the hardcoded fallback.
    const remaining = allTopics.filter(t => t !== topic)
    const updatedTargets = { ...targets }
    delete updatedTargets[topic]
    updateSettings.mutate({
      interviewTopics: JSON.stringify(remaining),
      interviewTargets: JSON.stringify(updatedTargets),
    }, {
      onSuccess: () => toast({ title: `Removed "${topicDisplay(topic)}"`, tone: 'success' }),
    })
  }

  const setTarget = (topic: string, field: 'daily' | 'monthly', value: number) => {
    const current = targets[topic] ?? { daily: 2, monthly: 30 }
    const updated = { ...targets, [topic]: { ...current, [field]: Math.max(0, Math.round(value)) } }
    saveTargets(updated)
  }

  return (
    <Section icon={Briefcase} title="Interview targets" hint="Daily and monthly goals per topic. Tracked on the Stats page.">
      <div className="space-y-3">
        {allTopics.map(topic => {
          const t = targets[topic] ?? { daily: 2, monthly: 30 }
          return (
            <div key={topic} className="flex items-center gap-3 rounded-lg bg-surface-3 px-3 py-2.5 ring-1 ring-border">
              <input
                defaultValue={topicDisplay(topic)}
                onBlur={e => {
                  const next = e.target.value.trim()
                  if (next && next.toUpperCase().replace(/\s+/g, '_') !== topic) {
                    renameTopic(topic, next)
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium focus:outline-none focus:underline"
                aria-label={`Rename ${topicDisplay(topic)}`}
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={t.daily}
                  onChange={e => setTarget(topic, 'daily', Number(e.target.value))}
                  className="h-7 w-12 rounded-md border border-input bg-background px-1.5 text-center text-[11.5px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
                <span className="text-[10px] text-muted-foreground">/day</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={t.monthly}
                  onChange={e => setTarget(topic, 'monthly', Number(e.target.value))}
                  className="h-7 w-12 rounded-md border border-input bg-background px-1.5 text-center text-[11.5px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
                <span className="text-[10px] text-muted-foreground">/mo</span>
              </div>
              <button
                onClick={() => deleteTopic(topic)}
                aria-label={`Delete ${topicDisplay(topic)}`}
                className="shrink-0 text-muted-foreground transition hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={newTopic}
          onChange={e => setNewTopic(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTopic() }}
          placeholder="New topic (e.g. Behavioral)"
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
        />
        <button
          onClick={addTopic}
          disabled={!newTopic.trim()}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md bg-surface-3 px-2.5 text-[12px] ring-1 ring-border transition hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Add topic
        </button>
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground">
        Custom topics appear as new tabs in Interview Prep.
      </p>
    </Section>
  )
}

function topicDisplay(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function DataSection() {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const doImport = async (file: File, mode: 'replace' | 'merge') => {
    setImporting(true)
    try {
      const text = await file.text()
      await api.backup.import(text, mode)
      toast({
        title: `Backup imported (${mode})`,
        body: 'Reloading to pick up the restored data.',
        tone: 'success',
      })
      setTimeout(() => location.reload(), 900)
    } catch (e: any) {
      toast({ title: 'Import failed', body: e.message, tone: 'warning' })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const pick = (mode: 'replace' | 'merge') => {
    const input = fileRef.current
    if (!input) return
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (mode === 'replace' && !confirm(
        'Replace mode wipes the current database and restores from this file. This cannot be undone. Continue?'
      )) { input.value = ''; return }
      doImport(file, mode)
    }
    input.click()
  }

  return (
    <Section icon={Database} title="Your data" hint="Local SQLite, no cloud, no account">
      <div className="space-y-2">
        <a
          href={api.backup.exportUrl()}
          download
          className="flex items-center gap-2.5 rounded-lg bg-surface-3 px-3 py-2.5 ring-1 ring-border transition hover:ring-primary/40"
        >
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium">Export a JSON backup</p>
            <p className="text-[10.5px] text-muted-foreground">Every table, as one portable file</p>
          </div>
        </a>

        <button
          onClick={() => pick('merge')}
          disabled={importing}
          className="flex w-full items-center gap-2.5 rounded-lg bg-surface-3 px-3 py-2.5 text-left ring-1 ring-border transition hover:ring-primary/40 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium">Import and merge</p>
            <p className="text-[10.5px] text-muted-foreground">Adds rows from the file, keeps what you have</p>
          </div>
        </button>

        <button
          onClick={() => pick('replace')}
          disabled={importing}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition disabled:opacity-50"
          style={{ background: 'color-mix(in oklch, var(--destructive) 10%, transparent)' }}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-destructive">Import and replace</p>
            <p className="text-[10.5px] text-muted-foreground">Wipes everything first. Export a backup before you do this.</p>
          </div>
        </button>

        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" />
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        Splanner also snapshots the database to <code className="text-foreground">data/backups/</code> once
        a day when the server starts.
      </p>
    </Section>
  )
}

/* -------------------------------------------------------------- primitives */

function Section({
  icon: Icon, title, hint, children,
}: { icon: React.ComponentType<any>; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface-2 p-4 ring-1 ring-border">
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-3">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-[13.5px] font-semibold leading-tight">{title}</h3>
          {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Row({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-[12.5px]">{label}</p>
        {hint && <p className="mt-0.5 text-[10.5px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function NumInput({
  value, onChange, suffix, step = 1, min, max,
}: { value: number; onChange: (v: number) => void; suffix?: string; step?: number; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-[12.5px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
      />
      {suffix && <span className="min-w-12 text-[11px] text-muted-foreground">{suffix}</span>}
    </div>
  )
}

function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-full transition',
        checked ? 'bg-primary' : 'bg-surface-3 ring-1 ring-border'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
          checked ? 'left-[18px]' : 'left-0.5'
        )}
      />
    </button>
  )
}

function ChoiceGroup({
  value, options, onChange, label,
}: { value: string; options: readonly string[]; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-lg bg-surface-3 p-1 ring-1 ring-border">
      {options.map(o => {
        const active = o === value
        return (
          <button
            key={o}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o)}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-medium capitalize transition',
              active ? 'text-white' : 'text-muted-foreground hover:text-foreground'
            )}
            style={active ? { background: 'var(--grad-selected)' } : undefined}
          >
            {o === 'extra-large' ? 'XL' : o}
          </button>
        )
      })}
    </div>
  )
}
