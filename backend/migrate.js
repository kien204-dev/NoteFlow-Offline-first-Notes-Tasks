import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool } from './db.js'
import { logger } from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pool = createPool()
const migrationsDir = path.resolve(__dirname, 'migrations')

try {
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort((left, right) => left.localeCompare(right))

  for (const file of migrationFiles) {
    const migration = await readFile(path.join(migrationsDir, file), 'utf8')
    await pool.query(migration)
    logger.info(`Applied migration ${file}`)
  }

  logger.info('Database migrated')
} finally {
  await pool.end()
}
