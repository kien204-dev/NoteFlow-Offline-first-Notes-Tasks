import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool } from './db.js'
import { logger } from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pool = createPool()
const migration = await readFile(path.resolve(__dirname, 'migrations/001_init.sql'), 'utf8')

try {
  await pool.query(migration)
  logger.info('Database migrated')
} finally {
  await pool.end()
}
