import {
  db,
  type ConflictRecord,
  type NoteFlowDatabase,
  type NoteRecord,
  type TaskRecord,
} from '../db/schema'
import { useSyncStatusStore } from './statusStore'
import { createSyncApi, type SyncApiOptions } from './syncApi'
import type { ServerNote, ServerTask } from './types'

export type RunSyncOptions = SyncApiOptions & {
  database?: NoteFlowDatabase
  isOnline?: () => boolean
  now?: () => string
}

const epoch = '1970-01-01T00:00:00.000Z'

const toIso = (timestamp: number | null) => (timestamp == null ? null : new Date(timestamp).toISOString())
const toTimestamp = (value: string | null) => (value == null ? null : new Date(value).getTime())
const toDateInputValue = (value: string | null) => (value ? value.slice(0, 10) : null)

const noteToServer = (note: NoteRecord): ServerNote => ({
  id: note.id,
  title: note.title,
  content: note.content,
  tags: note.tags,
  createdAt: toIso(note.createdAt) ?? epoch,
  updatedAt: toIso(note.updatedAt) ?? epoch,
  deletedAt: toIso(note.deletedAt),
  baseVersion: toIso(note.baseVersion),
})

const taskToServer = (task: TaskRecord): ServerTask => ({
  id: task.id,
  title: task.title,
  notes: task.notes,
  dueDate: task.dueDate,
  completed: task.completed,
  tags: task.tags,
  createdAt: toIso(task.createdAt) ?? epoch,
  updatedAt: toIso(task.updatedAt) ?? epoch,
  deletedAt: toIso(task.deletedAt),
  baseVersion: toIso(task.baseVersion),
})

const noteFromServer = (note: ServerNote): NoteRecord => ({
  ...note,
  createdAt: toTimestamp(note.createdAt) ?? 0,
  updatedAt: toTimestamp(note.updatedAt) ?? 0,
  deletedAt: toTimestamp(note.deletedAt),
  dirty: false,
  baseVersion: toTimestamp(note.updatedAt),
})

const taskFromServer = (task: ServerTask): TaskRecord => ({
  ...task,
  dueDate: toDateInputValue(task.dueDate),
  createdAt: toTimestamp(task.createdAt) ?? 0,
  updatedAt: toTimestamp(task.updatedAt) ?? 0,
  deletedAt: toTimestamp(task.deletedAt),
  dirty: false,
  baseVersion: toTimestamp(task.updatedAt),
})

const getLastSyncedAt = async (database: NoteFlowDatabase) =>
  (await database.syncMeta.get('lastSyncedAt'))?.value ?? epoch

const setLastSyncedAt = (database: NoteFlowDatabase, value: string) =>
  database.syncMeta.put({ key: 'lastSyncedAt', value })

const clearDirtyForSaved = async (
  database: NoteFlowDatabase,
  saved: { notes: string[]; tasks: string[] },
) => {
  await database.transaction('rw', database.notes, database.tasks, async () => {
    await Promise.all(
      saved.notes.map(async (id) => {
        const note = await database.notes.get(id)
        if (note) await database.notes.update(id, { dirty: false, baseVersion: note.updatedAt })
      }),
    )
    await Promise.all(
      saved.tasks.map(async (id) => {
        const task = await database.tasks.get(id)
        if (task) await database.tasks.update(id, { dirty: false, baseVersion: task.updatedAt })
      }),
    )
  })
}

const storeConflicts = async (
  database: NoteFlowDatabase,
  dirtyNotes: NoteRecord[],
  conflicts: {
    notes: Array<{ id: string; serverVersion: ServerNote }>
    tasks: Array<{ id: string; serverVersion: ServerTask }>
  },
) => {
  const dirtyNotesById = new Map(dirtyNotes.map((note) => [note.id, note]))
  const detectedAt = Date.now()
  const records: ConflictRecord[] = conflicts.notes.flatMap((conflict) => {
      const localVersion = dirtyNotesById.get(conflict.id)
      if (!localVersion) return []

      return [{
        id: `note:${conflict.id}`,
        entity: 'note' as const,
        localVersion: noteToServer(localVersion),
        serverVersion: conflict.serverVersion,
        detectedAt,
      }]
    })

  if (records.length) {
    await database.conflicts.bulkPut(records)
  }
}

const mergeNote = async (database: NoteFlowDatabase, serverNote: ServerNote) => {
  if (serverNote.deletedAt) {
    await database.notes.delete(serverNote.id)
    return
  }

  const local = await database.notes.get(serverNote.id)
  const next = noteFromServer(serverNote)

  if (!local || next.updatedAt > local.updatedAt) {
    await database.notes.put(next)
  }
}

const mergeTask = async (database: NoteFlowDatabase, serverTask: ServerTask) => {
  if (serverTask.deletedAt) {
    await database.tasks.delete(serverTask.id)
    return
  }

  const local = await database.tasks.get(serverTask.id)
  const next = taskFromServer(serverTask)

  if (!local || next.updatedAt > local.updatedAt) {
    await database.tasks.put(next)
  }
}

export const runSync = async ({
  database = db,
  isOnline = () => navigator.onLine,
  now = () => new Date().toISOString(),
  ...apiOptions
}: RunSyncOptions = {}) => {
  const setStatus = useSyncStatusStore.getState().setStatus

  if (!isOnline()) {
    setStatus({ status: 'offline', error: null })
    return { skipped: 'offline' as const }
  }

  const api = createSyncApi(apiOptions)

  try {
    setStatus({ status: 'syncing', error: null })

    const [dirtyNotes, dirtyTasks, lastSyncedAt] = await Promise.all([
      database.notes.filter((note) => note.dirty).toArray(),
      database.tasks.filter((task) => task.dirty).toArray(),
      getLastSyncedAt(database),
    ])

    const pushResponse = await api.push({
      notes: dirtyNotes.map(noteToServer),
      tasks: dirtyTasks.map(taskToServer),
    })

    await clearDirtyForSaved(database, pushResponse.saved)
    await storeConflicts(database, dirtyNotes, pushResponse.conflicts)

    const pullResponse = await api.pull(lastSyncedAt)

    await database.transaction('rw', database.notes, database.tasks, async () => {
      for (const note of pullResponse.notes) {
        await mergeNote(database, note)
      }
      for (const task of pullResponse.tasks) {
        await mergeTask(database, task)
      }
    })

    const syncedAt = now()
    await setLastSyncedAt(database, syncedAt)
    setStatus({ status: 'synced', lastSyncedAt: syncedAt, error: null })

    return {
      pushed: { notes: dirtyNotes.length, tasks: dirtyTasks.length },
      pulled: { notes: pullResponse.notes.length, tasks: pullResponse.tasks.length },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error'
    setStatus({ status: 'error', error: message })
    return { error: message }
  }
}
