import { db, type ConflictRecord, type NoteFlowDatabase, type NoteRecord } from '../db/schema'
import { runSync, type RunSyncOptions } from './syncEngine'
import type { ServerNote } from './types'

const toTimestamp = (value: string | null) => (value == null ? null : new Date(value).getTime())

export const noteFromServerVersion = (note: ServerNote): NoteRecord => ({
  id: note.id,
  title: note.title,
  content: note.content,
  tags: note.tags,
  createdAt: toTimestamp(note.createdAt) ?? 0,
  updatedAt: toTimestamp(note.updatedAt) ?? 0,
  deletedAt: toTimestamp(note.deletedAt),
  dirty: false,
  baseVersion: toTimestamp(note.updatedAt),
})

const getNoteConflict = async (conflictId: string, database: NoteFlowDatabase) => {
  const conflict = await database.conflicts.get(conflictId)
  if (!conflict || conflict.entity !== 'note') {
    throw new Error(`Note conflict not found: ${conflictId}`)
  }

  return conflict as ConflictRecord & {
    localVersion: ServerNote
    serverVersion: ServerNote
  }
}

export const keepLocalNoteConflict = async (
  conflictId: string,
  { database = db, ...syncOptions }: RunSyncOptions = {},
) => {
  const conflict = await getNoteConflict(conflictId, database)
  const serverBaseVersion = toTimestamp(conflict.serverVersion.updatedAt)
  const now = Date.now()

  await database.notes.put({
    ...noteFromServerVersion(conflict.localVersion),
    updatedAt: now,
    dirty: true,
    baseVersion: serverBaseVersion,
  })
  await database.conflicts.delete(conflictId)

  return runSync({ database, ...syncOptions })
}

export const keepServerNoteConflict = async (
  conflictId: string,
  database: NoteFlowDatabase = db,
) => {
  const conflict = await getNoteConflict(conflictId, database)

  await database.notes.put(noteFromServerVersion(conflict.serverVersion))
  await database.conflicts.delete(conflictId)
}

export const saveMergedNoteConflict = async (
  conflictId: string,
  merged: Pick<NoteRecord, 'title' | 'content' | 'tags'>,
  { database = db, ...syncOptions }: RunSyncOptions = {},
) => {
  const conflict = await getNoteConflict(conflictId, database)
  const serverBaseVersion = toTimestamp(conflict.serverVersion.updatedAt)
  const now = Date.now()

  await database.notes.put({
    ...noteFromServerVersion(conflict.localVersion),
    ...merged,
    title: merged.title.trim() || 'Untitled note',
    tags: Array.from(new Set(merged.tags.map((tag) => tag.trim()).filter(Boolean))),
    updatedAt: now,
    dirty: true,
    baseVersion: serverBaseVersion,
  })
  await database.conflicts.delete(conflictId)

  return runSync({ database, ...syncOptions })
}
