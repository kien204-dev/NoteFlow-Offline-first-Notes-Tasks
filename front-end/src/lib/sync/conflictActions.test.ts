import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, type NoteFlowDatabase } from '../db/schema'
import {
  keepLocalNoteConflict,
  keepServerNoteConflict,
  saveMergedNoteConflict,
} from './conflictActions'
import type { ServerNote } from './types'

let database: NoteFlowDatabase

const serverNote = (overrides: Partial<ServerNote> = {}): ServerNote => ({
  id: crypto.randomUUID(),
  title: 'Server title',
  content: 'Server body',
  tags: ['server'],
  createdAt: new Date(1_000).toISOString(),
  updatedAt: new Date(2_000).toISOString(),
  deletedAt: null,
  baseVersion: null,
  ...overrides,
})

const createConflict = async () => {
  const id = crypto.randomUUID()
  const localVersion = serverNote({
    id,
    title: 'Local title',
    content: 'Local body',
    updatedAt: new Date(1_500).toISOString(),
  })
  const serverVersion = serverNote({ id })

  await database.notes.put({
    id,
    title: localVersion.title,
    content: localVersion.content,
    tags: localVersion.tags,
    createdAt: 1_000,
    updatedAt: 1_500,
    deletedAt: null,
    trashedAt: null,
    dirty: true,
    baseVersion: 1_000,
  })
  await database.conflicts.put({
    id: `note:${id}`,
    entity: 'note',
    localVersion,
    serverVersion,
    detectedAt: 3_000,
  })

  return { id, conflictId: `note:${id}`, serverVersion }
}

const successFetcher = vi.fn(async (request: RequestInfo | URL) => {
  const url = String(request)
  if (url.includes('/push')) {
    return new Response(
      JSON.stringify({ saved: { notes: [], tasks: [] }, conflicts: { notes: [], tasks: [] } }),
      { status: 200 },
    )
  }

  return new Response(JSON.stringify({ notes: [], tasks: [] }), { status: 200 })
})

beforeEach(() => {
  database = createDatabase(`noteflow-conflict-actions-${crypto.randomUUID()}`)
})

afterEach(async () => {
  vi.restoreAllMocks()
  database.close()
  await database.delete()
})

describe('conflictActions', () => {
  it('keeps the local note and prepares it to push over the current server version', async () => {
    const { id, conflictId } = await createConflict()

    await keepLocalNoteConflict(conflictId, {
      database,
      fetcher: successFetcher as typeof fetch,
      isOnline: () => true,
    })

    const note = await database.notes.get(id)
    expect(note).toMatchObject({ title: 'Local title', dirty: true, baseVersion: 2_000 })
    expect(await database.conflicts.get(conflictId)).toBeUndefined()
  })

  it('keeps the server note and clears local dirty state', async () => {
    const { id, conflictId } = await createConflict()

    await keepServerNoteConflict(conflictId, database)

    const note = await database.notes.get(id)
    expect(note).toMatchObject({ title: 'Server title', dirty: false, baseVersion: 2_000 })
    expect(await database.conflicts.get(conflictId)).toBeUndefined()
  })

  it('saves a manually merged note and prepares it to sync', async () => {
    const { id, conflictId } = await createConflict()

    await saveMergedNoteConflict(
      conflictId,
      { title: 'Merged', content: 'Combined body', tags: ['merged'] },
      { database, fetcher: successFetcher as typeof fetch, isOnline: () => true },
    )

    const note = await database.notes.get(id)
    expect(note).toMatchObject({
      title: 'Merged',
      content: 'Combined body',
      tags: ['merged'],
      dirty: true,
      baseVersion: 2_000,
    })
    expect(await database.conflicts.get(conflictId)).toBeUndefined()
  })
})
