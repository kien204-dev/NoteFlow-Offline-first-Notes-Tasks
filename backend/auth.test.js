import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
import { newDb } from 'pg-mem'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cookieName = 'noteflow_refresh_test'

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

const registerPayload = (overrides = {}) => ({
  email: 'ada@example.com',
  password: 'correct-password',
  ...overrides,
})

const refreshCookieFrom = (response) =>
  response.headers['set-cookie'].find((cookie) => cookie.startsWith(`${cookieName}=`))

describe('auth API', () => {
  let pool
  let app

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-for-auth-routes'
    process.env.JWT_ACCESS_TOKEN_EXPIRES_IN = '15m'
    process.env.JWT_REFRESH_TOKEN_EXPIRES_IN = '30d'
    process.env.REFRESH_TOKEN_COOKIE_NAME = cookieName
    process.env.REFRESH_TOKEN_COOKIE_SECURE = 'false'
    process.env.REFRESH_TOKEN_COOKIE_SAME_SITE = 'lax'

    pool = await createTestPool()
    app = createApp({ pool, allowedOrigins: 'http://localhost:5173' })
  })

  it('registers a user and sets an httpOnly refresh cookie', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(registerPayload())
      .expect(201)

    expect(response.body.accessToken).toEqual(expect.any(String))
    expect(response.body.user).toMatchObject({ email: 'ada@example.com' })
    expect(response.body.user).not.toHaveProperty('password')
    expect(response.body.user).not.toHaveProperty('password_hash')
    expect(response.body.user).not.toHaveProperty('passwordHash')

    const refreshCookie = refreshCookieFrom(response)
    expect(refreshCookie).toContain(`${cookieName}=`)
    expect(refreshCookie).toContain('HttpOnly')
    expect(refreshCookie).toContain('SameSite=Lax')
  })

  it('allows frontend origin to receive auth cookies', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send(registerPayload())
      .expect(201)

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
    expect(refreshCookieFrom(response)).toContain(`${cookieName}=`)
  })

  it('rejects duplicate register emails without creating another user', async () => {
    await request(app).post('/api/auth/register').send(registerPayload()).expect(201)

    const response = await request(app)
      .post('/api/auth/register')
      .send(registerPayload({ email: 'ADA@example.com' }))
      .expect(409)

    expect(response.body.error).toBe('email already registered')

    const users = await pool.query('select count(*)::int as count from users')
    expect(Number(users.rows[0].count)).toBe(1)
  })

  it('rejects short register passwords', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(registerPayload({ password: 'short' }))
      .expect(400)

    expect(response.body.error).toBe('password must be at least 8 characters')
  })

  it('logs in with valid credentials', async () => {
    await request(app).post('/api/auth/register').send(registerPayload()).expect(201)

    const response = await request(app)
      .post('/api/auth/login')
      .send(registerPayload())
      .expect(200)

    expect(response.body.accessToken).toEqual(expect.any(String))
    expect(response.body.user).not.toHaveProperty('password')
    expect(response.body.user).not.toHaveProperty('password_hash')
    expect(response.body.user).not.toHaveProperty('passwordHash')
    expect(refreshCookieFrom(response)).toContain(`${cookieName}=`)
  })

  it('uses the same invalid credentials error for wrong password and missing email', async () => {
    await request(app).post('/api/auth/register').send(registerPayload()).expect(201)

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send(registerPayload({ password: 'wrong-password' }))
      .expect(401)

    const missingEmail = await request(app)
      .post('/api/auth/login')
      .send(registerPayload({ email: 'missing@example.com' }))
      .expect(401)

    expect(wrongPassword.body.error).toBe('invalid credentials')
    expect(missingEmail.body.error).toBe('invalid credentials')
  })

  it('refreshes an access token with a valid refresh cookie', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(registerPayload())
      .expect(201)
    const refreshCookie = refreshCookieFrom(registerResponse)

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200)

    expect(response.body.accessToken).toEqual(expect.any(String))
  })

  it('rejects invalid or expired refresh tokens', async () => {
    const expiredToken = jwt.sign(
      {
        userId: crypto.randomUUID(),
        email: 'ada@example.com',
        type: 'refresh',
      },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' },
    )

    const invalidResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${cookieName}=not-a-token`)
      .expect(401)

    const expiredResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${cookieName}=${expiredToken}`)
      .expect(401)

    expect(invalidResponse.body.error).toBe('invalid refresh token')
    expect(expiredResponse.body.error).toBe('invalid refresh token')
  })

  it('clears the refresh cookie on logout', async () => {
    const response = await request(app).post('/api/auth/logout').expect(204)
    const clearCookie = refreshCookieFrom(response)

    expect(clearCookie).toContain(`${cookieName}=`)
    expect(clearCookie).toMatch(/Expires=Thu, 01 Jan 1970/)
  })
})
