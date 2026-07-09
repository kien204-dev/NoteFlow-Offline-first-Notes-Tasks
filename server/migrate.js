import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createPool } from './db.js'

const pool = createPool()
const migration = await readFile(join(process.cwd(), 'server/migrations/001_init.sql'), 'utf8')

try {
  await pool.query(migration)
  console.log('Database migrated')
} finally {
  await pool.end()
}
