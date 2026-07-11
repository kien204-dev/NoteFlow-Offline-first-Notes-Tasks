import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesRepo from '../db/notesRepo'
import { createDatabase, type NoteFlowDatabase } from '../db/schema'
import { useAuthStore } from '../../features/auth/authStore'
import { useSyncStatusStore } from './statusStore'
import { runSync } from './syncEngine'
import type { PullResponse, PushResponse } from './types'

let database: NoteFlowDatabase

const jsonResponse = (body: PushResponse | PullResponse) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const pushResponse = (savedNotes: string[] = []): PushResponse => ({
  saved: { notes: savedNotes, tasks: [] },
  conflicts: { notes: [], tasks: [] },
})

const pullResponse = (body: Partial<PullResponse> = {}): PullResponse => ({
  notes: [],
  tasks: [],
  ...body,
})

beforeEach(() => {
  database = createDatabase(`noteflow-sync-test-${crypto.randomUUID()}`)
  useAuthStore.getState().setAuth({
    accessToken: 'access-token',
    user: { id: 'user-1', email: 'ada@example.com' },
  })
  useSyncStatusStore.setState({ status: 'idle', lastSyncedAt: null, error: null })
})

afterEach(async () => {
  vi.restoreAllMocks()
  useAuthStore.getState().clearAuth()
  database.close()
  await database.delete()
})

describe('runSync', () => {
  it('skips sync when there is no access token', async () => {
    useAuthStore.getState().clearAuth()
    const fetcher = vi.fn()

    const result = await runSync({ database, fetcher, isOnline: () => true })

    expect(result).toEqual({ skipped: 'unauthenticated' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('clears dirty after a successful push', async () => {
    const note = await notesRepo.create({ title: 'Push me', content: '' }, database)
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pushResponse([note.id])))
      .mockResolvedValueOnce(jsonResponse(pullResponse()))

    await runSync({ database, fetcher, isOnline: () => true })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer access-token',
    })
    expect((await database.notes.get(note.id))?.dirty).toBe(false)
    expect(useSyncStatusStore.getState().status).toBe('synced')
  })

  it('skips fetch while offline and keeps local records dirty', async () => {
    const note = await notesRepo.create({ title: 'Offline note', content: '' }, database)
    const fetcher = vi.fn()

    await runSync({ database, fetcher, isOnline: () => false })

    expect(fetcher).not.toHaveBeenCalled()
    expect((await database.notes.get(note.id))?.dirty).toBe(true)
    expect(useSyncStatusStore.getState().status).toBe('offline')
  })

  it('overwrites local data when pulled server record is newer', async () => {
    const note = await notesRepo.create({ title: 'Old local', content: '' }, database)
    await database.notes.update(note.id, { dirty: false, updatedAt: 1_000 })
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pushResponse()))
      .mockResolvedValueOnce(
        jsonResponse(
          pullResponse({
            notes: [
              {
                ...note,
                title: 'New server',
                createdAt: new Date(1_000).toISOString(),
                updatedAt: new Date(2_000).toISOString(),
                deletedAt: null,
                baseVersion: null,
              },
            ],
          }),
        ),
      )

    await runSync({ database, fetcher, isOnline: () => true })

    expect((await database.notes.get(note.id))?.title).toBe('New server')
  })

  it('does not overwrite a newer local dirty record with an older pull record', async () => {
    const note = await notesRepo.create({ title: 'New local', content: '' }, database)
    await database.notes.update(note.id, { updatedAt: 3_000, dirty: true })
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pushResponse()))
      .mockResolvedValueOnce(
        jsonResponse(
          pullResponse({
            notes: [
              {
                ...note,
                title: 'Old server',
                createdAt: new Date(1_000).toISOString(),
                updatedAt: new Date(2_000).toISOString(),
                deletedAt: null,
                baseVersion: null,
              },
            ],
          }),
        ),
      )

    await runSync({ database, fetcher, isOnline: () => true })

    const stored = await database.notes.get(note.id)
    expect(stored?.title).toBe('New local')
    expect(stored?.dirty).toBe(true)
  })

  it('hard-deletes local records when a pulled tombstone arrives', async () => {
    const note = await notesRepo.create({ title: 'Delete me', content: '' }, database)
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pushResponse()))
      .mockResolvedValueOnce(
        jsonResponse(
          pullResponse({
            notes: [
              {
                ...note,
                createdAt: new Date(1_000).toISOString(),
                updatedAt: new Date(4_000).toISOString(),
                deletedAt: new Date(4_000).toISOString(),
                baseVersion: null,
              },
            ],
          }),
        ),
      )

    await runSync({ database, fetcher, isOnline: () => true })

    expect(await database.notes.get(note.id)).toBeUndefined()
  })

  it('stores note conflicts and keeps the local record dirty', async () => {
    const note = await notesRepo.create({ title: 'Local draft', content: 'Mine' }, database)
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        saved: { notes: [], tasks: [] },
        conflicts: {
          notes: [
            {
              id: note.id,
              serverVersion: {
                id: note.id,
                title: 'Server draft',
                content: 'Theirs',
                tags: [],
                createdAt: new Date(1_000).toISOString(),
                updatedAt: new Date(2_000).toISOString(),
                deletedAt: null,
                baseVersion: null,
              },
            },
          ],
          tasks: [],
        },
      }),
    ).mockResolvedValueOnce(jsonResponse(pullResponse()))

    await runSync({ database, fetcher, isOnline: () => true })

    expect((await database.notes.get(note.id))?.dirty).toBe(true)
    expect(await database.conflicts.get(`note:${note.id}`)).toMatchObject({
      entity: 'note',
    })
  })

  it('refreshes an expired access token and retries the sync request', async () => {
    const note = await notesRepo.create({ title: 'Refresh me', content: '' }, database)
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'token_expired', error: 'access token expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: 'fresh-token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(jsonResponse(pushResponse([note.id])))
      .mockResolvedValueOnce(jsonResponse(pullResponse()))

    await runSync({ database, fetcher, isOnline: () => true })

    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(fetcher.mock.calls[2][1]?.headers).toMatchObject({
      Authorization: 'Bearer fresh-token',
    })
    expect(useAuthStore.getState().accessToken).toBe('fresh-token')
    expect((await database.notes.get(note.id))?.dirty).toBe(false)
  })

  it('clears auth on invalid token without deleting Dexie data', async () => {
    const note = await notesRepo.create({ title: 'Keep local', content: '' }, database)
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'invalid_token', error: 'invalid access token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await runSync({ database, fetcher, isOnline: () => true })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(await database.notes.get(note.id)).toBeDefined()
  })

  it('does not refresh, clear auth, or delete data while offline', async () => {
    const note = await notesRepo.create({ title: 'Offline expired', content: '' }, database)
    const fetcher = vi.fn()

    await runSync({ database, fetcher, isOnline: () => false })

    expect(fetcher).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(await database.notes.get(note.id)).toBeDefined()
  })
})
