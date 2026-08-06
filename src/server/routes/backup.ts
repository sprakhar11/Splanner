import { Hono } from 'hono'
import { exportAsJson, importFromJson } from '../services/backup'

const backupRoute = new Hono()

backupRoute.get('/export', async (c) => {
  const json = exportAsJson()
  c.header('Content-Type', 'application/json')
  c.header('Content-Disposition',
    `attachment; filename="splanner-backup-${new Date().toISOString().split('T')[0]}.json"`)
  return c.body(json)
})

backupRoute.post('/import', async (c) => {
  const body = await c.req.text()
  const mode = (c.req.query('mode') || 'replace') as 'replace' | 'merge'
  try {
    importFromJson(body, mode)
    return c.json({ success: true, mode })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default backupRoute
