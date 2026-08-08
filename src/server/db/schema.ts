import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ===== Categories =====
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: integer('color').notNull(), // ARGB
  iconName: text('icon_name').notNull().default('folder'),
  position: integer('position').notNull().default(0),
})

// ===== Tasks =====
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').default(''),
  priority: text('priority', { enum: ['P1', 'P2', 'P3', 'P4'] }).notNull().default('P3'),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  estimatedMinutes: integer('estimated_minutes').notNull().default(30),
  actualMinutes: integer('actual_minutes'),
  deadline: integer('deadline'), // epoch-ms
  reminderAt: integer('reminder_at'), // epoch-ms
  repeat: text('repeat', { enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] }).notNull().default('NONE'),
  attachedNotes: text('attached_notes').default(''),
  linkedNoteId: text('linked_note_id'),
  status: text('status', { enum: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'SNOOZED'] }).notNull().default('TODO'),
  date: text('date').notNull(), // yyyy-MM-dd
  position: integer('position').notNull().default(0),
  seriesId: text('series_id'), // links recurrence chain
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
})

// ===== Subtasks =====
export const subtasks = sqliteTable('subtasks', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  position: integer('position').notNull().default(0),
})

// ===== Notes =====
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').default(''),
  type: text('type', { enum: ['CONCEPT', 'INTERVIEW_QUESTION', 'CODE_SNIPPET', 'MISTAKE', 'GENERAL'] }).notNull().default('GENERAL'),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  codeLanguage: text('code_language'),
  links: text('links').default('[]'), // JSON array
  imageUris: text('image_uris').default('[]'), // JSON array
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  revisionScheduled: integer('revision_scheduled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
})

// ===== Revision Items =====
export const revisionItems = sqliteTable('revision_items', {
  id: text('id').primaryKey(),
  noteId: text('note_id').references(() => notes.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  concept: text('concept').default(''),
  codeSnippet: text('code_snippet'),
  currentStepIndex: integer('current_step_index').notNull().default(0),
  nextDueDate: text('next_due_date').notNull(), // yyyy-MM-dd
  lastRevisedDate: text('last_revised_date'),
  totalRevisions: integer('total_revisions').notNull().default(0),
})

// ===== Revision History =====
export const revisionHistory = sqliteTable('revision_history', {
  id: text('id').primaryKey(),
  revisionItemId: text('revision_item_id').notNull().references(() => revisionItems.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // yyyy-MM-dd
  grade: text('grade', { enum: ['AGAIN', 'HARD', 'GOOD', 'EASY'] }).notNull(),
  intervalDays: integer('interval_days').notNull(),
})

// ===== Daily Reflections =====
export const reflections = sqliteTable('reflections', {
  id: text('id').primaryKey(),
  date: text('date').notNull().unique(), // yyyy-MM-dd, one per day
  tasksCompletedCount: integer('tasks_completed_count').notNull().default(0),
  hoursStudied: real('hours_studied').notNull().default(0),
  problemsSolvedCount: integer('problems_solved_count').notNull().default(0),
  learnedSummary: text('learned_summary').default(''),
  struggledSummary: text('struggled_summary').default(''),
  mood: integer('mood').notNull().default(3), // 1-5
  gratitude: text('gratitude').default(''),
})

// ===== Interview Items (unified) =====
export const interviewItems = sqliteTable('interview_items', {
  id: text('id').primaryKey(),
  topicType: text('topic_type').notNull(), // DSA, SYSTEM_DESIGN, LLD, or any custom type
  title: text('title').notNull(),
  description: text('description').default(''),
  link: text('link').default(''),
  tags: text('tags').default('[]'), // JSON array of strings
  // PENDING = task not done yet, DONE = done (no revision), REVISION_PENDING = in queue awaiting first review
  status: text('status').notNull().default('DONE'),
  revisionItemId: text('revision_item_id'), // FK to revision_items when queued
  linkedTaskId: text('linked_task_id'), // FK to tasks — triggers status change on task completion
  scheduleRevision: integer('schedule_revision', { mode: 'boolean' }).notNull().default(false), // intent to revise once done
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
})

// ===== DSA Problems (legacy — migrated to interview_items) =====
export const dsaProblems = sqliteTable('dsa_problems', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  difficulty: text('difficulty', { enum: ['EASY', 'MEDIUM', 'HARD'] }).notNull().default('MEDIUM'),
  platform: text('platform', { enum: ['LEETCODE', 'GEEKSFORGEEKS', 'CODEFORCES', 'INTERVIEWBIT', 'OTHER'] }).notNull().default('LEETCODE'),
  categoryPattern: text('category_pattern').default(''),
  timeTakenMinutes: integer('time_taken_minutes').default(0),
  mistakesNotes: text('mistakes_notes').default(''),
  solutionSnippet: text('solution_snippet').default(''),
  url: text('url').default(''),
  revisionDue: text('revision_due'), // yyyy-MM-dd
  status: text('status', { enum: ['SOLVED', 'ATTEMPTED', 'TO_REVISE'] }).notNull().default('ATTEMPTED'),
})

// ===== System Design Topics =====
export const systemDesign = sqliteTable('system_design', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category', { enum: ['DISTRIBUTED_SYSTEMS', 'DATABASES', 'NETWORKING', 'CACHING', 'ARCHITECTURE_PATTERNS'] }).notNull(),
  notes: text('notes').default(''),
  keyTradeoffs: text('key_tradeoffs').default('[]'), // JSON array
  isRevised: integer('is_revised', { mode: 'boolean' }).notNull().default(false),
  lastRevised: text('last_revised'), // yyyy-MM-dd
})

// ===== LLD Designs =====
export const lldDesigns = sqliteTable('lld_designs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  pattern: text('pattern', { enum: ['STRATEGY', 'OBSERVER', 'FACTORY', 'DECORATOR', 'SOLID', 'SYSTEM_DESIGN'] }).notNull(),
  description: text('description').default(''),
  codeSnippet: text('code_snippet').default(''),
  status: text('status', { enum: ['IMPLEMENTED', 'IN_PROGRESS', 'BACKLOG'] }).notNull().default('BACKLOG'),
})

// ===== HR / Behavioural Stories =====
export const hrStories = sqliteTable('hr_stories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  questionCategory: text('question_category', { enum: ['LEADERSHIP', 'CONFLICT_RESOLUTION', 'FAILURE_AND_GROWTH', 'PROBLEM_SOLVING', 'BEHAVIORAL'] }).notNull(),
  situation: text('situation').default(''),
  task: text('task').default(''),
  action: text('action').default(''),
  result: text('result').default(''),
})

// ===== Study Sessions =====
export const studySessions = sqliteTable('study_sessions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // yyyy-MM-dd
  minutes: integer('minutes').notNull().default(0),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  note: text('note').default(''),
})

// ===== Notifications =====
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').default(''),
  type: text('type', { enum: ['TASK', 'OVERDUE', 'REVISION', 'WATER', 'REFLECTION', 'SYSTEM'] }).notNull(),
  taskId: text('task_id'),
  revisionItemId: text('revision_item_id'),
  timestamp: integer('timestamp').notNull().$defaultFn(() => Date.now()),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
})

// ===== Tag Junction Tables =====
export const taskTags = sqliteTable('task_tags', {
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
})

export const noteTags = sqliteTable('note_tags', {
  noteId: text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
})

export const revisionItemTags = sqliteTable('revision_item_tags', {
  revisionItemId: text('revision_item_id').notNull().references(() => revisionItems.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
})

export const hrStoryTags = sqliteTable('hr_story_tags', {
  hrStoryId: text('hr_story_id').notNull().references(() => hrStories.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
})

// ===== Settings (key-value) =====
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
