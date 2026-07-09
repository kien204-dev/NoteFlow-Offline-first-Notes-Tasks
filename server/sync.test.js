import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { newDb } from 'pg-mem'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'

const createTestPool = async () => {
  const db = newDb()
  db.public.registerFunction({
    name: 'now',
    returns: 'timestamptz',
    implementation: () => new Date(),
  })
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  const migration = await readFile(join(process.cwd(), 'server/migrations/001_init.sql'), 'utf8')
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
    expect(pushResponse.body.serverWins.notes).toEqual([])

    const pullResponse = await request(app)
      .get('/api/sync/pull')
      .query({ since: '2026-07-08T00:00:00.000Z' })
      .expect(200)

    expect(pullResponse.body.notes).toMatchObject([
      { id: note.id, title: 'Local note', deletedAt: null },
    ])
  })

  it('keeps the server row when server updated_at is newer', async () => {
    const id = crypto.randomUUID()
    const serverNote = notePayload({
      id,
      title: 'Server wins',
      updatedAt: '2026-07-09T00:05:00.000Z',
    })
    const staleClientNote = notePayload({
      id,
      title: 'Stale client',
      updatedAt: '2026-07-09T00:02:00.000Z',
    })

    await request(app).post('/api/sync/push').send({ notes: [serverNote], tasks: [] }).expect(200)

    const response = await request(app)
      .post('/api/sync/push')
      .send({ notes: [staleClientNote], tasks: [] })
      .expect(200)

    expect(response.body.saved.notes).toEqual([])
    expect(response.body.serverWins.notes).toMatchObject([{ id, title: 'Server wins' }])
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
