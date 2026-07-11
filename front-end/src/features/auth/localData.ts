import { db, type NoteFlowDatabase } from '../../lib/db/schema'

export const hasDirtyLocalData = async (database: NoteFlowDatabase = db) => {
  const [dirtyNotes, dirtyTasks] = await Promise.all([
    database.notes.filter((note) => note.dirty).count(),
    database.tasks.filter((task) => task.dirty).count(),
  ])

  return dirtyNotes + dirtyTasks > 0
}

export const clearLocalData = async (database: NoteFlowDatabase = db) => {
  await database.transaction(
    'rw',
    database.notes,
    database.tasks,
    database.syncMeta,
    database.conflicts,
    async () => {
      await Promise.all([
        database.notes.clear(),
        database.tasks.clear(),
        database.syncMeta.clear(),
        database.conflicts.clear(),
      ])
    },
  )
}
