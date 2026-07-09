import './env.js'
import pg from 'pg'

const { Pool } = pg

export const createPool = () => {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  const needsSsl =
    process.env.NODE_ENV === 'production' || connectionString.includes('sslmode=require')

  return new Pool({
    connectionString,
    // Neon/Render production connections require TLS. Local Postgres keeps SSL disabled.
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  })
}
