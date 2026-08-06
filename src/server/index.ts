import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { seedDatabase } from './db/seed'
import { ensureSearchIndex } from './db/search-index'
import { migrateInterviewItems } from './db/migrate-interview'
import { topUpAllSeries } from './services/task-series'
import { performAutoBackup } from './services/backup'

// Routes
import tasksRoute from './routes/tasks'
import notesRoute from './routes/notes'
import revisionsRoute from './routes/revisions'
import categoriesRoute from './routes/categories'
import dsaRoute from './routes/dsa'
import systemDesignRoute from './routes/system-design'
import lldRoute from './routes/lld'
import hrStoriesRoute from './routes/hr-stories'
import interviewItemsRoute from './routes/interview-items'
import studySessionsRoute from './routes/study-sessions'
import reflectionsRoute from './routes/reflections'
import settingsRoute from './routes/settings'
import searchRoute from './routes/search'
import backupRoute from './routes/backup'

// Startup tasks
seedDatabase()
migrateInterviewItems()
ensureSearchIndex()
// Roll the recurrence horizon forward so open series never run dry.
const series = topUpAllSeries()
if (series.created > 0) {
  console.log(`[series] Generated ${series.created} occurrences across ${series.series} series.`)
}
performAutoBackup()

const app = new Hono()

app.use('*', cors({ origin: '*' }))

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() })
})

// Mount routes
app.route('/api/tasks', tasksRoute)
app.route('/api/notes', notesRoute)
app.route('/api/revisions', revisionsRoute)
app.route('/api/categories', categoriesRoute)
app.route('/api/dsa', dsaRoute)
app.route('/api/system-design', systemDesignRoute)
app.route('/api/lld', lldRoute)
app.route('/api/hr-stories', hrStoriesRoute)
app.route('/api/interview-items', interviewItemsRoute)
app.route('/api/study-sessions', studySessionsRoute)
app.route('/api/reflections', reflectionsRoute)
app.route('/api/settings', settingsRoute)
app.route('/api/search', searchRoute)
app.route('/api/backup', backupRoute)

const port = Number(process.env.PORT) || 3001

serve({
  fetch: app.fetch,
  hostname: '127.0.0.1',
  port,
}, (info) => {
  console.log(`[server] Splanner API running at http://127.0.0.1:${info.port}`)
})

export default app
export type AppType = typeof app
