import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'

const dbPath = process.env.DB_FILE_NAME || 'data/splanner.db'
const dbDir = path.dirname(dbPath)

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(dbPath)

// Performance & safety pragmas
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('synchronous = NORMAL')
sqlite.pragma('cache_size = -16000') // 16MB

export const db = drizzle(sqlite, { schema })
export { sqlite }
