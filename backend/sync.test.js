import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
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
  const migrationsDir = path.resolve(__dirname, 'migrations')
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort((left, right) => left.localeCompare(right))

  for (const file of migrationFiles) {
    const migration = await readFile(path.join(migrationsDir, file), 'utf8')
    await pool.query(migration)
  }

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

const taskPayload = (overrides = {}) => ({
  id: crypto.randomUUID(),
  title: 'Local task',
  notes: 'Created offline',
  dueDate: null,
  priority: 'medium',
  completed: false,
  subtasks: [],
  tags: ['sync'],
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:01:00.000Z',
  deletedAt: null,
  baseVersion: null,
  ...overrides,
})

const registerUser = async (app, overrides = {}) => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      email: overrides.email ?? `user-${crypto.randomUUID()}@example.com`,
      password: overrides.password ?? 'correct-password',
    })
    .expect(201)

  return {
    accessToken: response.body.accessToken,
    user: response.body.user,
  }
}

const authHeader = (accessToken) => `Bearer ${accessToken}`

describe('sync API', () => {
  let pool
  let app

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-for-sync-routes'
    process.env.JWT_ACCESS_TOKEN_EXPIRES_IN = '15m'
    process.env.JWT_REFRESH_TOKEN_EXPIRES_IN = '30d'
    process.env.REFRESH_TOKEN_COOKIE_NAME = 'noteflow_refresh_test'
    process.env.REFRESH_TOKEN_COOKIE_SECURE = 'false'
    process.env.REFRESH_TOKEN_COOKIE_SAME_SITE = 'lax'

    pool = await createTestPool()
    app = createApp({ pool, allowedOrigins: 'http://localhost:5173' })
  })

  it('pushes records and pulls changed rows since a cursor', async () => {
    const { accessToken } = await registerUser(app)
    const note = notePayload()

    const pushResponse = await request(app)
      .post('/api/sync/push')
      .set('Authorization', authHeader(accessToken))
      .send({ notes: [note], tasks: [] })
      .expect(200)

    expect(pushResponse.body.saved.notes).toEqual([note.id])
    expect(pushResponse.body.conflicts.notes).toEqual([])

    const pullResponse = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', authHeader(accessToken))
      .query({ since: '2026-07-08T00:00:00.000Z' })
      .expect(200)

    expect(pullResponse.body.notes).toMatchObject([
      { id: note.id, title: 'Local note', deletedAt: null },
    ])
  })

  it('returns a conflict when baseVersion does not match the server version', async () => {
    const { accessToken } = await registerUser(app)
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

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', authHeader(accessToken))
      .send({ notes: [serverNote], tasks: [] })
      .expect(200)

    const response = await request(app)
      .post('/api/sync/push')
      .set('Authorization', authHeader(accessToken))
      .send({ notes: [staleClientNote], tasks: [] })
      .expect(200)

    expect(response.body.saved.notes).toEqual([])
    expect(response.body.conflicts.notes).toMatchObject([
      { id, serverVersion: { id, title: 'Server wins' } },
    ])
  })

  it('returns tombstones during pull', async () => {
    const { accessToken } = await registerUser(app)
    const deletedAt = '2026-07-09T00:03:00.000Z'
    const note = notePayload({ deletedAt, updatedAt: deletedAt })

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', authHeader(accessToken))
      .send({ notes: [note], tasks: [] })
      .expect(200)

    const response = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', authHeader(accessToken))
      .query({ since: '2026-07-09T00:02:00.000Z' })
      .expect(200)

    expect(response.body.notes[0]).toMatchObject({ id: note.id, deletedAt })
  })

  it('rejects push and pull without an access token', async () => {
    const pushResponse = await request(app)
      .post('/api/sync/push')
      .send({ notes: [], tasks: [] })
      .expect(401)

    const pullResponse = await request(app)
      .get('/api/sync/pull')
      .query({ since: '2026-07-08T00:00:00.000Z' })
      .expect(401)

    expect(pushResponse.body).toMatchObject({
      code: 'missing_token',
      error: 'access token required',
    })
    expect(pullResponse.body).toMatchObject({
      code: 'missing_token',
      error: 'access token required',
    })
  })

  it('rejects expired access tokens with a distinct code', async () => {
    const expiredToken = jwt.sign(
      { userId: crypto.randomUUID(), email: 'expired@example.com', type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' },
    )

    const response = await request(app)
      .post('/api/sync/push')
      .set('Authorization', authHeader(expiredToken))
      .send({ notes: [], tasks: [] })
      .expect(401)

    expect(response.body).toMatchObject({
      code: 'token_expired',
      error: 'access token expired',
    })
  })

  it('rejects malformed access tokens with a distinct code', async () => {
    const response = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', 'Bearer not-a-jwt')
      .query({ since: '2026-07-08T00:00:00.000Z' })
      .expect(401)

    expect(response.body).toMatchObject({
      code: 'invalid_token',
      error: 'invalid access token',
    })
  })

  it('does not let one user pull another user data', async () => {
    const userA = await registerUser(app, { email: 'user-a@example.com' })
    const userB = await registerUser(app, { email: 'user-b@example.com' })
    const note = notePayload({ title: 'User A private note' })
    const task = taskPayload({ title: 'User A private task' })

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', authHeader(userA.accessToken))
      .send({ notes: [note], tasks: [task] })
      .expect(200)

    const response = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', authHeader(userB.accessToken))
      .query({ since: '2026-07-08T00:00:00.000Z' })
      .expect(200)

    expect(response.body.notes).toEqual([])
    expect(response.body.tasks).toEqual([])
  })

  it('syncs task due date, priority, and subtasks', async () => {
    const { accessToken } = await registerUser(app)
    const task = taskPayload({
      dueDate: '2026-07-20T00:00:00.000Z',
      priority: 'high',
      subtasks: [
        { id: 'subtask-1', title: 'Draft checklist', completed: true },
        { id: 'subtask-2', title: 'Review release notes', completed: false },
      ],
    })

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', authHeader(accessToken))
      .send({ notes: [], tasks: [task] })
      .expect(200)

    const response = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', authHeader(accessToken))
      .query({ since: '2026-07-08T00:00:00.000Z' })
      .expect(200)

    expect(response.body.tasks).toMatchObject([
      {
        id: task.id,
        dueDate: '2026-07-20T00:00:00.000Z',
        priority: 'high',
        subtasks: task.subtasks,
      },
    ])
  })

  it('ignores attempts to overwrite another user note or task by known id', async () => {
    const userA = await registerUser(app, { email: 'attacker@example.com' })
    const userB = await registerUser(app, { email: 'owner@example.com' })
    const ownerNote = notePayload({ title: 'Owner note' })
    const ownerTask = taskPayload({ title: 'Owner task', completed: false })

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', authHeader(userB.accessToken))
      .send({ notes: [ownerNote], tasks: [ownerTask] })
      .expect(200)

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', authHeader(userA.accessToken))
      .send({
        notes: [
          notePayload({
            id: ownerNote.id,
            title: 'Attacker overwrite',
            updatedAt: '2026-07-09T00:05:00.000Z',
          }),
        ],
        tasks: [
          taskPayload({
            id: ownerTask.id,
            title: 'Attacker overwrite',
            completed: true,
            updatedAt: '2026-07-09T00:05:00.000Z',
          }),
        ],
      })
      .expect(200)

    const ownerPull = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', authHeader(userB.accessToken))
      .query({ since: '2026-07-08T00:00:00.000Z' })
      .expect(200)

    expect(ownerPull.body.notes).toMatchObject([{ id: ownerNote.id, title: 'Owner note' }])
    expect(ownerPull.body.tasks).toMatchObject([
      { id: ownerTask.id, title: 'Owner task', completed: false },
    ])
  })

  it('does not expose legacy rows with null user_id', async () => {
    const { accessToken } = await registerUser(app)
    const legacyNoteId = crypto.randomUUID()

    await pool.query(
      `
        insert into notes (id, title, content, tags, created_at, updated_at, deleted_at, user_id)
        values ($1, 'Legacy note', '', '{}', $2, $2, null, null)
      `,
      [legacyNoteId, new Date('2026-07-09T00:01:00.000Z')],
    )

    const response = await request(app)
      .get('/api/sync/pull')
      .set('Authorization', authHeader(accessToken))
      .query({ since: '2026-07-08T00:00:00.000Z' })
      .expect(200)

    expect(response.body.notes).toEqual([])
  })
})
