import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { newDb } from 'pg-mem'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const createTestPool = async () => {
  const db = newDb()
  db.public.registerFunction({
    name: 'now',
    returns: 'timestamptz',
    implementation: () => new Date(),
  })
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  const migration = await readFile(path.resolve(__dirname, 'migrations/001_init.sql'), 'utf8')
  await pool.query(migration)
  return pool
}

const notePayload = (overrides = {}) => ({
  id: crypto.randomUUID(),
  title: 'Local note',
  content: 'Created offline',
  tags: ['sync'],
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:01:00.000Z',
  deletedAt: null,
  baseVersion: null,
  ...overrides,
})

describe('sync API', () => {
  let pool
  let app

  beforeEach(async () => {
    pool = await createTestPool()
    app = createApp({ pool, allowedOrigins: '*' })
  })

  it('pushes records and pulls changed rows since a cursor', async () => {
    const note = notePayload()

    const pushResponse = await request(app)
      .post('/api/sync/push')
      .send({ notes: [note], tasks: [] })
      .expect(200)

    expect(pushResponse.body.saved.notes).toEqual([note.id])
    expect(pushResponse.body.conflicts.notes).toEqual([])

    const pullResponse = await request(app)
      .get('/api/sync/pull')
      .query({ since: '2026-07-08T00:00:00.000Z' })
      .expect(200)

    expect(pullResponse.body.notes).toMatchObject([
      { id: note.id, title: 'Local note', deletedAt: null },
    ])
  })

  it('returns a conflict when baseVersion does not match the server version', async () => {
    const id = crypto.randomUUID()
    const serverNote = notePayload({
      id,
      title: 'Server wins',
      updatedAt: '2026-07-09T00:05:00.000Z',
      baseVersion: null,
    })
    const staleClientNote = notePayload({
      id,
      title: 'Stale client',
      updatedAt: '2026-07-09T00:02:00.000Z',
      baseVersion: '2026-07-09T00:01:00.000Z',
    })

    await request(app).post('/api/sync/push').send({ notes: [serverNote], tasks: [] }).expect(200)

    const response = await request(app)
      .post('/api/sync/push')
      .send({ notes: [staleClientNote], tasks: [] })
      .expect(200)

    expect(response.body.saved.notes).toEqual([])
    expect(response.body.conflicts.notes).toMatchObject([
      { id, serverVersion: { id, title: 'Server wins' } },
    ])
  })

  it('returns tombstones during pull', async () => {
    const deletedAt = '2026-07-09T00:03:00.000Z'
    const note = notePayload({ deletedAt, updatedAt: deletedAt })

    await request(app).post('/api/sync/push').send({ notes: [note], tasks: [] }).expect(200)

    const response = await request(app)
      .get('/api/sync/pull')
      .query({ since: '2026-07-09T00:02:00.000Z' })
      .expect(200)

    expect(response.body.notes[0]).toMatchObject({ id: note.id, deletedAt })
  })
})
