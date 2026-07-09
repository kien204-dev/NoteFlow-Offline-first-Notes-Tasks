import pg from 'pg'

const { Pool } = pg

export const createPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
  })
}
