import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesRepo from '../../lib/db/notesRepo'
import { createDatabase, type NoteFlowDatabase } from '../../lib/db/schema'
import * as tasksRepo from '../../lib/db/tasksRepo'
import { runSync } from '../../lib/sync/syncEngine'
import type { PushPayload, ServerNote, ServerTask } from '../../lib/sync/types'
import { createAuthApi } from './authApi'
import { useAuthStore } from './authStore'

type MockUser = {
  id: string
  email: string
  password: string
}

type MockServer = {
  fetcher: typeof fetch
  notes: Array<ServerNote & { userId: string }>
  tasks: Array<ServerTask & { userId: string }>
}

let database: NoteFlowDatabase

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const createMockServer = (): MockServer => {
  const usersByEmail = new Map<string, MockUser>()
  const usersByToken = new Map<string, MockUser>()
  const notes: Array<ServerNote & { userId: string }> = []
  const tasks: Array<ServerTask & { userId: string }> = []
  let nextUser = 1
  let nextToken = 1

  const issueToken = (user: MockUser) => {
    const token = `token-${nextToken}`
    nextToken += 1
    usersByToken.set(token, user)
    return token
  }

  const readBody = (init?: RequestInit) =>
    init?.body ? JSON.parse(String(init.body)) : {}

  const authUser = (init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined
    const authorization = headers?.Authorization ?? headers?.authorization
    const token = authorization?.replace(/^Bearer\s+/i, '')
    return token ? usersByToken.get(token) : undefined
  }

  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url.endsWith('/api/auth/register')) {
      const body = readBody(init)
      const email = String(body.email).toLowerCase()
      const user: MockUser = {
        id: `user-${nextUser}`,
        email,
        password: String(body.password),
      }
      nextUser += 1
      usersByEmail.set(email, user)
      return jsonResponse({ accessToken: issueToken(user), user }, 201)
    }

    if (url.endsWith('/api/auth/login')) {
      const body = readBody(init)
      const user = usersByEmail.get(String(body.email).toLowerCase())
      if (!user || user.password !== body.password) {
        return jsonResponse({ error: 'invalid credentials' }, 401)
      }

      return jsonResponse({ accessToken: issueToken(user), user })
    }

    if (url.endsWith('/api/auth/refresh')) {
      const firstUser = Array.from(usersByEmail.values())[0]
      if (!firstUser) return jsonResponse({ error: 'invalid refresh token' }, 401)
      return jsonResponse({ accessToken: issueToken(firstUser) })
    }

    const user = authUser(init)
    if (!user) return jsonResponse({ code: 'missing_token', error: 'missing access token' }, 401)

    if (url.endsWith('/api/sync/push')) {
      const payload = readBody(init) as PushPayload
      for (const note of payload.notes) {
        const existingIndex = notes.findIndex(
          (record) => record.id === note.id && record.userId === user.id,
        )
        const next = { ...note, userId: user.id }
        if (existingIndex >= 0) notes[existingIndex] = next
        else notes.push(next)
      }

      for (const task of payload.tasks) {
        const existingIndex = tasks.findIndex(
          (record) => record.id === task.id && record.userId === user.id,
        )
        const next = { ...task, userId: user.id }
        if (existingIndex >= 0) tasks[existingIndex] = next
        else tasks.push(next)
      }

      return jsonResponse({
        saved: {
          notes: payload.notes.map((note) => note.id),
          tasks: payload.tasks.map((task) => task.id),
        },
        conflicts: { notes: [], tasks: [] },
      })
    }

    if (url.includes('/api/sync/pull')) {
      return jsonResponse({
        notes: notes.filter((note) => note.userId === user.id).map(({ userId: _userId, ...note }) => note),
        tasks: tasks.filter((task) => task.userId === user.id).map(({ userId: _userId, ...task }) => task),
      })
    }

    return jsonResponse({ error: 'not found' }, 404)
  }) as unknown as typeof fetch

  return { fetcher, notes, tasks }
}

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  database = createDatabase(`noteflow-auth-e2e-${crypto.randomUUID()}`)
  useAuthStore.getState().clearAuth()
})

afterEach(async () => {
  vi.restoreAllMocks()
  useAuthStore.getState().clearAuth()
  database.close()
  await database.delete()
})

describe('auth multi-user verification flow', () => {
  it('syncs offline user A data after reconnect and keeps user B isolated', async () => {
    const server = createMockServer()
    const authApi = createAuthApi({ baseUrl: 'http://localhost:4000', fetcher: server.fetcher })

    await authApi.register({ email: 'ada@example.com', password: 'correct-password' })
    const userALogin = await authApi.login({
      email: 'ada@example.com',
      password: 'correct-password',
    })
    useAuthStore.getState().setAuth(userALogin)

    const note = await notesRepo.create({ title: 'A offline note', content: 'local first' }, database)
    const task = await tasksRepo.create({ title: 'A offline task' }, database)

    await runSync({ database, fetcher: server.fetcher, isOnline: () => false })
    expect(server.notes).toHaveLength(0)
    expect(server.tasks).toHaveLength(0)

    await runSync({ database, fetcher: server.fetcher, isOnline: () => true })
    expect(server.notes.map((record) => record.id)).toContain(note.id)
    expect(server.tasks.map((record) => record.id)).toContain(task.id)
    expect((await database.notes.get(note.id))?.dirty).toBe(false)
    expect((await database.tasks.get(task.id))?.dirty).toBe(false)

    useAuthStore.getState().clearAuth()
    const userBDatabase = createDatabase(`noteflow-auth-e2e-b-${crypto.randomUUID()}`)
    try {
      await authApi.register({ email: 'grace@example.com', password: 'correct-password' })
      const userBLogin = await authApi.login({
        email: 'grace@example.com',
        password: 'correct-password',
      })
      useAuthStore.getState().setAuth(userBLogin)

      await runSync({ database: userBDatabase, fetcher: server.fetcher, isOnline: () => true })

      expect(await userBDatabase.notes.toArray()).toHaveLength(0)
      expect(await userBDatabase.tasks.toArray()).toHaveLength(0)
    } finally {
      userBDatabase.close()
      await userBDatabase.delete()
    }
  })

  it('keeps local data through refresh failure and lets the same user resume later', async () => {
    const note = await notesRepo.create({ title: 'Survives auth loss', content: '' }, database)
    useAuthStore.getState().setAuth({
      accessToken: 'expired-token',
      user: { id: 'user-1', email: 'ada@example.com' },
    })
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ code: 'token_expired', error: 'access token expired' }, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ error: 'invalid refresh token' }, 401))

    await runSync({ database, fetcher, isOnline: () => true })

    expect(window.location.pathname).toBe('/login')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(await database.notes.get(note.id)).toBeDefined()

    useAuthStore.getState().setAuth({
      accessToken: 'new-access-token',
      user: { id: 'user-1', email: 'ada@example.com' },
    })

    expect(await database.notes.get(note.id)).toBeDefined()
  })
})
